import "server-only";

import type {
  AdminResultsGeoGroup,
  AdminResultsPayload,
  AdminResultsTallyRow,
} from "@/lib/admin/results-tallies-types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

export type { AdminResultsGeoGroup, AdminResultsPayload, AdminResultsTallyRow };

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

function isMissingResultsRpcError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  return (
    (msg.includes("function") && msg.includes("get_results_tallies_by_confcode")) ||
    (msg.includes("could not find") && msg.includes("function")) ||
    msg.includes("schema cache")
  );
}

/**
 * Same semantics as `get_results_tallies_by_confcode` SQL, without requiring that RPC
 * (e.g. migration not applied yet or PostgREST schema cache not reloaded).
 */
async function fetchTalliesWithoutRpc(
  supabase: ServiceClient,
  activeConfcode: string,
): Promise<AdminResultsTallyRow[]> {
  const { data: candidates, error: cErr } = await supabase
    .from("candidates")
    .select("id, geo_group_id, full_name, photo_url, is_active")
    .eq("confcode", activeConfcode);

  if (cErr) {
    const { message } = toPublicMessage(cErr, "Unable to load candidates for results.");
    throw new Error(message);
  }

  const cList = (candidates ?? []) as Record<string, unknown>[];
  if (cList.length === 0) return [];

  const counts = new Map<string, number>();
  const candIds = cList.map((c) => String(c.id ?? ""));

  const ID_CHUNK = 150;

  for (let i = 0; i < candIds.length; i += ID_CHUNK) {
    const chunk = candIds.slice(i, i + ID_CHUNK);
    const { data: choices, error: chErr } = await supabase
      .from("ballot_choices")
      .select("candidate_id, ballot_id")
      .in("candidate_id", chunk);

    if (chErr) {
      const { message } = toPublicMessage(chErr, "Unable to load ballot choices for results.");
      throw new Error(message);
    }

    const choiceRows = (choices ?? []) as { candidate_id?: string; ballot_id?: string }[];
    const ballotIds = [...new Set(choiceRows.map((x) => String(x.ballot_id ?? "")).filter(Boolean))];
    if (ballotIds.length === 0) continue;

    const validSubmitted = new Set<string>();
    const BALLOT_CHUNK = 200;
    for (let j = 0; j < ballotIds.length; j += BALLOT_CHUNK) {
      const bChunk = ballotIds.slice(j, j + BALLOT_CHUNK);
      const { data: ballots, error: bErr } = await supabase
        .from("ballots")
        .select("id, is_submitted, confcode")
        .in("id", bChunk)
        .eq("is_submitted", true);

      if (bErr) {
        const { message } = toPublicMessage(bErr, "Unable to load ballots for results.");
        throw new Error(message);
      }

      for (const b of ballots ?? []) {
        const row = b as { id?: string; confcode?: string | null };
        const bid = String(row.id ?? "");
        const conf = row.confcode == null || row.confcode === "" ? null : String(row.confcode);
        if (conf != null && conf !== activeConfcode) continue;
        validSubmitted.add(bid);
      }
    }

    for (const ch of choiceRows) {
      const bid = String(ch.ballot_id ?? "");
      const cid = String(ch.candidate_id ?? "");
      if (!bid || !cid) continue;
      if (!validSubmitted.has(bid)) continue;
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
  }

  return cList.map((c) => {
    const id = String(c.id ?? "");
    const gid = c.geo_group_id;
    return {
      candidate_id: id,
      full_name: String(c.full_name ?? ""),
      photo_url: c.photo_url == null ? null : String(c.photo_url),
      is_active: c.is_active == null ? null : Boolean(c.is_active),
      sort_order: null,
      vote_count: counts.get(id) ?? 0,
      geo_group_id:
        gid == null || gid === ""
          ? null
          : typeof gid === "number" && Number.isFinite(gid)
            ? gid
            : Number(gid),
    };
  });
}

function mapRpcRow(row: Record<string, unknown>): AdminResultsTallyRow {
  const gid = row.geo_group_id;
  return {
    candidate_id: String(row.candidate_id ?? ""),
    full_name: String(row.full_name ?? ""),
    photo_url: row.photo_url == null ? null : String(row.photo_url),
    is_active: row.is_active == null ? null : Boolean(row.is_active),
    sort_order: row.sort_order == null ? null : Number(row.sort_order),
    vote_count: Number(row.vote_count ?? 0),
    geo_group_id:
      gid == null || gid === ""
        ? null
        : typeof gid === "number" && Number.isFinite(gid)
          ? gid
          : Number(gid),
  };
}

export async function getAdminResultsPayload(): Promise<AdminResultsPayload> {
  const supabase = createSupabaseServiceRoleClient();
  const fetchedAt = new Date().toISOString();

  const { data: settingsRow, error: settingsErr } = await supabase
    .from("app_settings")
    .select("active_confcode")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    const { message } = toPublicMessage(settingsErr, "Unable to load app settings.");
    throw new Error(message);
  }

  const activeConfcodeRaw = (settingsRow as { active_confcode?: string | null } | null)
    ?.active_confcode;
  const activeConfcode =
    activeConfcodeRaw != null && String(activeConfcodeRaw).trim() !== ""
      ? String(activeConfcodeRaw).trim()
      : null;

  if (!activeConfcode) {
    return {
      activeConfcode: null,
      conferenceName: null,
      totalVoters: 0,
      geoGroups: [],
      rows: [],
      fetchedAt,
    };
  }

  const [
    { data: confRow, error: confErr },
    { data: geoRows, error: geoErr },
    { count: voterRollCount, error: voterCountErr },
    { data: rpcRows, error: rpcErr },
  ] = await Promise.all([
    supabase
      .from("conference")
      .select("name")
      .eq("confcode", activeConfcode)
      .maybeSingle(),
    supabase
      .from("geo_groups")
      .select("id, code, name, sort_order")
      .or("is_active.is.null,is_active.eq.true")
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase.from("voters").select("id", { count: "exact", head: true }),
    supabase.rpc("get_results_tallies_by_confcode", {
      p_confcode: activeConfcode,
    }),
  ]);

  if (confErr || geoErr) {
    const { message } = toPublicMessage(confErr ?? geoErr, "Unable to load results metadata.");
    throw new Error(message);
  }

  if (voterCountErr) {
    // eslint-disable-next-line no-console
    console.error("voters roll count failed", voterCountErr);
  }
  const totalVoters =
    !voterCountErr && typeof voterRollCount === "number" && voterRollCount >= 0 ? voterRollCount : 0;

  let rows: AdminResultsTallyRow[];
  if (!rpcErr) {
    rows = (rpcRows ?? []).map((r: unknown) => mapRpcRow(r as Record<string, unknown>));
  } else if (isMissingResultsRpcError(rpcErr)) {
    rows = await fetchTalliesWithoutRpc(supabase, activeConfcode);
  } else {
    const { message } = toPublicMessage(rpcErr, "Unable to load vote tallies.");
    throw new Error(message);
  }

  const conferenceName =
    confRow && typeof (confRow as { name?: unknown }).name === "string"
      ? String((confRow as { name: string }).name)
      : null;

  const geoGroups: AdminResultsGeoGroup[] = (geoRows ?? []).map((g) => {
    const row = g as Record<string, unknown>;
    return {
      id: Number(row.id),
      code: String(row.code ?? ""),
      name: String(row.name ?? ""),
      sort_order: row.sort_order == null ? null : Number(row.sort_order),
    };
  });

  return {
    activeConfcode,
    conferenceName,
    totalVoters,
    geoGroups,
    rows,
    fetchedAt,
  };
}
