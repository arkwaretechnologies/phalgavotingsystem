import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { AppSettings, Candidate, Conference, GeoGroup } from "@/lib/db/types";
import { toPublicMessage } from "@/lib/errors/public-message";

function numId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new Error("Invalid bigint id from database");
}

function mapGeoGroup(row: Record<string, unknown>): GeoGroup {
  return {
    id: numId(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    max_votes: row.max_votes == null ? null : Number(row.max_votes),
    is_active: row.is_active == null ? null : Boolean(row.is_active),
    sort_order: row.sort_order == null ? null : Number(row.sort_order),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

function mapCandidate(row: Record<string, unknown>): Candidate {
  return {
    id: String(row.id),
    geo_group_id: row.geo_group_id == null ? null : numId(row.geo_group_id),
    full_name: String(row.full_name ?? ""),
    photo_url: row.photo_url == null ? null : String(row.photo_url),
    bio: row.bio == null ? null : String(row.bio),
    is_active: row.is_active == null || row.is_active === true,
    created_at: String(row.created_at ?? ""),
    confcode: String(row.confcode ?? ""),
  };
}

function mapConference(row: Record<string, unknown>): Conference {
  return {
    confcode: String(row.confcode ?? ""),
    name: row.name == null ? null : String(row.name),
    date_from: row.date_from == null ? null : String(row.date_from),
    date_to: row.date_to == null ? null : String(row.date_to),
    venue: row.venue == null ? null : String(row.venue),
  };
}

/**
 * Active rows from `public.geo_groups` (bigint `id`, unique `code` / `name`).
 * `is_active` null is treated as active in the filter (same as default true in DDL).
 */
export async function getActiveGeoGroups(): Promise<GeoGroup[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("geo_groups")
    .select("id, code, name, max_votes, is_active, sort_order, created_at")
    .or("is_active.is.null,is_active.eq.true")
    .order("sort_order", { ascending: true, nullsFirst: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("getActiveGeoGroups failed", error);
    const { message } = toPublicMessage(error, "Unable to load geo groups.");
    throw new Error(message);
  }
  return (data ?? []).map((row) => mapGeoGroup(row as Record<string, unknown>));
}

/**
 * Active confcode from `app_settings` and matching `conference` row.
 * For headers/login only — does not load candidates or geo groups.
 */
export async function getVotingActiveConference(): Promise<{
  activeConfcode: string | null;
  conference: Conference | null;
}> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: settingsRow, error: settingsErr } = await supabase
    .from("app_settings")
    .select("active_confcode")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    // eslint-disable-next-line no-console
    console.error("getVotingActiveConference settings load failed", settingsErr);
    const { message } = toPublicMessage(settingsErr, "Unable to load app settings.");
    throw new Error(message);
  }

  const activeConfcode = (
    (settingsRow as { active_confcode?: string | null } | null)?.active_confcode ?? ""
  )
    .trim() || null;

  if (!activeConfcode) {
    return { activeConfcode: null, conference: null };
  }

  const { data: confRow, error: confErr } = await supabase
    .from("conference")
    .select("confcode, name, date_from, date_to, venue")
    .eq("confcode", activeConfcode)
    .maybeSingle();

  if (confErr) {
    // eslint-disable-next-line no-console
    console.error("getVotingActiveConference conference load failed", confErr);
    const { message } = toPublicMessage(confErr, "Unable to load conference.");
    throw new Error(message);
  }

  const conference: Conference | null = confRow
    ? mapConference(confRow as Record<string, unknown>)
    : null;

  return { activeConfcode, conference };
}

/**
 * `app_settings` row (id 1) + `conference` row for `active_confcode`, and candidates
 * for that confcode. Candidates are filtered to active rows (`is_active` is null or true).
 */
export async function getVotingPageData(): Promise<{
  appSettings: AppSettings | null;
  activeConfcode: string | null;
  conference: Conference | null;
  geoGroups: GeoGroup[];
  candidates: Candidate[];
}> {
  const supabase = createSupabaseServiceRoleClient();
  const geoGroups = await getActiveGeoGroups();

  const { data: settingsRow, error: settingsErr } = await supabase
    .from("app_settings")
    .select("id, active_confcode, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    // eslint-disable-next-line no-console
    console.error("getVotingPageData settings load failed", settingsErr);
    const { message } = toPublicMessage(settingsErr, "Unable to load app settings.");
    throw new Error(message);
  }

  const appSettings: AppSettings | null = settingsRow
    ? {
        id: Number((settingsRow as { id: unknown }).id),
        active_confcode:
          (settingsRow as { active_confcode: string | null }).active_confcode ?? null,
        updated_at: String(
          (settingsRow as { updated_at: string }).updated_at ?? "",
        ),
      }
    : null;

  const activeConfcode = appSettings?.active_confcode?.trim() || null;

  if (!activeConfcode) {
    return {
      appSettings,
      activeConfcode: null,
      conference: null,
      geoGroups,
      candidates: [],
    };
  }

  const [{ data: confRow, error: confErr }, { data: candRows, error: candErr }] =
    await Promise.all([
      supabase
        .from("conference")
        .select("confcode, name, date_from, date_to, venue")
        .eq("confcode", activeConfcode)
        .maybeSingle(),
      supabase
        .from("candidates")
        .select(
          "id, geo_group_id, full_name, photo_url, bio, is_active, created_at, confcode",
        )
        .eq("confcode", activeConfcode)
        .or("is_active.is.null,is_active.eq.true")
        .order("full_name", { ascending: true }),
    ]);

  if (confErr || candErr) {
    // eslint-disable-next-line no-console
    console.error("getVotingPageData load failed", { confErr, candErr });
    const { message } = toPublicMessage(confErr ?? candErr, "Unable to load candidates right now.");
    throw new Error(message);
  }

  const conference: Conference | null = confRow
    ? mapConference(confRow as Record<string, unknown>)
    : null;

  const candidates = (candRows ?? [])
    .map((row) => mapCandidate(row as Record<string, unknown>))
    .filter((c) => c.is_active);

  return {
    appSettings,
    activeConfcode,
    conference,
    geoGroups,
    candidates,
  };
}

export async function getActiveCandidatesForVoting(): Promise<Candidate[]> {
  const { candidates } = await getVotingPageData();
  return candidates;
}

export async function getVotePageCatalog(): Promise<{
  geoGroups: GeoGroup[];
  candidates: Candidate[];
}> {
  const { geoGroups, candidates } = await getVotingPageData();
  return { geoGroups, candidates };
}
