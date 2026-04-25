import "server-only";

import type { AdminResultsTallyRow } from "@/lib/admin/results-tallies-types";
import type { DashboardGeoTopThree, DashboardSnapshot } from "@/lib/admin/dashboard-snapshot-types";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type { DashboardGeoTopThree, DashboardSnapshot };

const SESSION_LABELS: Record<string, string> = {
  queued: "Waiting (queued)",
  voting: "Actively voting",
  voted: "Finished (voted)",
  abandoned: "Abandoned",
};

const TABLET_LABELS: Record<string, string> = {
  vacant: "Vacant (available)",
  in_use: "In use",
  offline: "Offline",
};

function buildGeoTopThree(
  rows: AdminResultsTallyRow[],
  geoGroups: { id: number; code: string; name: string; sort_order: number | null }[],
): DashboardGeoTopThree[] {
  const byGeo = new Map<number, AdminResultsTallyRow[]>();
  for (const row of rows) {
    const gid = row.geo_group_id ?? -1;
    if (!byGeo.has(gid)) byGeo.set(gid, []);
    byGeo.get(gid)!.push(row);
  }

  const ordered = [...geoGroups].sort((a, b) => {
    const sa = a.sort_order ?? 999;
    const sb = b.sort_order ?? 999;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  const out: DashboardGeoTopThree[] = [];
  for (const g of ordered) {
    const list = byGeo.get(g.id) ?? [];
    const topThree = [...list]
      .sort(
        (a, b) =>
          b.vote_count - a.vote_count || a.full_name.localeCompare(b.full_name),
      )
      .slice(0, 3)
      .map((r) => ({ candidateName: r.full_name, voteCount: r.vote_count }));
    out.push({
      geoGroupId: g.id,
      geoCode: g.code,
      geoName: g.name,
      topThree,
    });
  }

  const unassigned = byGeo.get(-1);
  if (unassigned?.length) {
    const topThree = [...unassigned]
      .sort(
        (a, b) =>
          b.vote_count - a.vote_count || a.full_name.localeCompare(b.full_name),
      )
      .slice(0, 3)
      .map((r) => ({ candidateName: r.full_name, voteCount: r.vote_count }));
    out.push({
      geoGroupId: -1,
      geoCode: "—",
      geoName: "Unassigned geo",
      topThree,
    });
  }

  return out;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const results = await getAdminResultsPayload();
  const supabase = createSupabaseServiceRoleClient();
  const fetchedAt = new Date().toISOString();
  const activeConfcode = results.activeConfcode;

  const votedPromise =
    activeConfcode != null
      ? supabase
          .from("ballots")
          .select("id", { count: "exact", head: true })
          .eq("is_submitted", true)
          .eq("confcode", activeConfcode)
      : Promise.resolve({ count: 0, error: null });

  const sessionStatuses = ["queued", "voting", "voted", "abandoned"] as const;
  const sessionPromises = sessionStatuses.map((status) =>
    supabase.from("voting_sessions").select("id", { count: "exact", head: true }).eq("status", status),
  );

  const tabletStatuses = ["vacant", "in_use", "offline"] as const;
  const tabletPromises = tabletStatuses.map((status) =>
    supabase.from("tablets").select("id", { count: "exact", head: true }).eq("status", status),
  );

  const queuedSessionsPromise = supabase
    .from("voting_sessions")
    .select("queue_number, voter_id")
    .eq("status", "queued")
    .order("queue_number", { ascending: true });

  const votingQueuesPromise = supabase
    .from("voting_sessions")
    .select("queue_number")
    .eq("status", "voting")
    .order("queue_number", { ascending: true });

  const activeVotingTabletPromise = supabase
    .from("voting_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "voting")
    .eq("voted_via", "tablet");

  const activeVotingPhonePromise = supabase
    .from("voting_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "voting")
    .eq("voted_via", "phone");

  const activeVotingUnknownPromise = supabase
    .from("voting_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "voting")
    .is("voted_via", null);

  const bundle = await Promise.all([
    votedPromise,
    ...sessionPromises,
    ...tabletPromises,
    queuedSessionsPromise,
    votingQueuesPromise,
    activeVotingTabletPromise,
    activeVotingPhonePromise,
    activeVotingUnknownPromise,
  ]);

  const votedRes = bundle[0] as { count: number | null; error: { message?: string } | null };
  const sessionResults = bundle.slice(1, 5) as {
    count: number | null;
    error: { message?: string } | null;
  }[];
  const tabletResults = bundle.slice(5, 8) as {
    count: number | null;
    error: { message?: string } | null;
  }[];
  const queuedSessionsRes = bundle[8] as {
    data: unknown;
    error: { message?: string } | null;
  };
  const votingQueuesRes = bundle[9] as {
    data: unknown;
    error: { message?: string } | null;
  };
  const activeTabletRes = bundle[10] as { count: number | null; error: { message?: string } | null };
  const activePhoneRes = bundle[11] as { count: number | null; error: { message?: string } | null };
  const activeUnknownRes = bundle[12] as { count: number | null; error: { message?: string } | null };

  if (votedRes.error) {
    // eslint-disable-next-line no-console
    console.error("dashboard voted count failed", votedRes.error);
  }
  for (let i = 0; i < sessionResults.length; i++) {
    if (sessionResults[i].error) {
      // eslint-disable-next-line no-console
      console.error("dashboard session count failed", sessionStatuses[i], sessionResults[i].error);
    }
  }
  for (let i = 0; i < tabletResults.length; i++) {
    if (tabletResults[i].error) {
      // eslint-disable-next-line no-console
      console.error("dashboard tablet count failed", tabletStatuses[i], tabletResults[i].error);
    }
  }
  if (queuedSessionsRes.error) {
    // eslint-disable-next-line no-console
    console.error("dashboard queued sessions failed", queuedSessionsRes.error);
  }
  if (votingQueuesRes.error) {
    // eslint-disable-next-line no-console
    console.error("dashboard voting queues failed", votingQueuesRes.error);
  }
  if (activeTabletRes.error) {
    // eslint-disable-next-line no-console
    console.error("dashboard active voting tablet count failed", activeTabletRes.error);
  }
  if (activePhoneRes.error) {
    // eslint-disable-next-line no-console
    console.error("dashboard active voting phone count failed", activePhoneRes.error);
  }
  if (activeUnknownRes.error) {
    // eslint-disable-next-line no-console
    console.error("dashboard active voting unknown channel failed", activeUnknownRes.error);
  }

  const votedVoters =
    !votedRes.error && typeof votedRes.count === "number" && votedRes.count >= 0
      ? votedRes.count
      : 0;

  const sessionStatusCounts = sessionStatuses.map((status, i) => ({
    status,
    label: SESSION_LABELS[status] ?? status,
    count:
      !sessionResults[i].error && typeof sessionResults[i].count === "number"
        ? sessionResults[i].count!
        : 0,
  }));

  const tabletStatusCounts = tabletStatuses.map((status, i) => ({
    status,
    label: TABLET_LABELS[status] ?? status,
    count:
      !tabletResults[i].error && typeof tabletResults[i].count === "number"
        ? tabletResults[i].count!
        : 0,
  }));

  let queuedNumbersVerified: number[] = [];
  if (!queuedSessionsRes.error) {
    const qSessions = (queuedSessionsRes.data ?? []) as {
      queue_number: number;
      voter_id: string | null;
    }[];
    const voterIds = [...new Set(qSessions.map((s) => s.voter_id).filter(Boolean))] as string[];
    if (voterIds.length > 0) {
      const { data: verVoters, error: vErr } = await supabase
        .from("voters")
        .select("id")
        .in("id", voterIds)
        .eq("is_verified", true);
      if (!vErr) {
        const verified = new Set((verVoters ?? []).map((v) => v.id as string));
        queuedNumbersVerified = qSessions
          .filter((s) => s.voter_id && verified.has(s.voter_id))
          .map((s) => Number(s.queue_number))
          .filter((n) => Number.isFinite(n));
      }
    }
  }

  const votingQueueNumbers = !votingQueuesRes.error
    ? ((votingQueuesRes.data ?? []) as { queue_number: number }[])
        .map((r) => Number(r.queue_number))
        .filter((n) => Number.isFinite(n))
    : [];

  const activeVotingAtStations =
    !activeTabletRes.error && typeof activeTabletRes.count === "number" && activeTabletRes.count >= 0
      ? activeTabletRes.count
      : 0;
  const activeVotingOnOwnDevices =
    !activePhoneRes.error && typeof activePhoneRes.count === "number" && activePhoneRes.count >= 0
      ? activePhoneRes.count
      : 0;
  const activeVotingChannelUnknown =
    !activeUnknownRes.error &&
    typeof activeUnknownRes.count === "number" &&
    activeUnknownRes.count >= 0
      ? activeUnknownRes.count
      : 0;

  const geoTopThree = buildGeoTopThree(results.rows, results.geoGroups);

  return {
    fetchedAt,
    activeConfcode: results.activeConfcode,
    conferenceName: results.conferenceName,
    totalVoters: results.totalVoters,
    votedVoters,
    geoTopThree,
    sessionStatusCounts,
    tabletStatusCounts,
    queuedNumbersVerified,
    votingQueueNumbers,
    activeVotingAtStations,
    activeVotingOnOwnDevices,
    activeVotingChannelUnknown,
  };
}
