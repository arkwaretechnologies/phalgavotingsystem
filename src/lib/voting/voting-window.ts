import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type VotingWindow = {
  start: string | null;
  end: string | null;
};

function parseDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Treat naive timestamps as Manila time (UTC+08:00). If the string already includes
  // a timezone (Z or ±HH:MM), preserve it.
  const hasTz = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(s);
  const looksNaive =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(s) && !hasTz;
  const normalized = looksNaive ? `${s.replace(" ", "T") }+08:00` : s.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function getVotingWindow(): Promise<VotingWindow> {
  const supabase = createSupabaseServiceRoleClient();
  // Columns may vary between DB versions; attempt the current schema first, then fall back.
  const attemptA = await supabase
    .from("app_settings")
    .select(
      "vote_start_date_time, vote_end_date_time, voting_start_date_time, voting_end_date_time",
    )
    .eq("id", 1)
    .maybeSingle();

  const attemptB =
    attemptA.error != null
      ? await supabase
          .from("app_settings")
          .select("vote_start_date_time, vote_end_date_time")
          .eq("id", 1)
          .maybeSingle()
      : null;

  const data = (attemptA.data ?? attemptB?.data ?? null) as Record<string, unknown> | null;

  const start = (data?.vote_start_date_time ?? data?.voting_start_date_time ?? null) as unknown;
  const end = (data?.vote_end_date_time ?? data?.voting_end_date_time ?? null) as unknown;
  return {
    start: start == null ? null : String(start),
    end: end == null ? null : String(end),
  };
}

export type VotingWindowStatus =
  | { kind: "open"; remainingMs: number | null }
  | { kind: "not_started"; startsInMs: number | null }
  | { kind: "closed"; endedMsAgo: number | null };

export function getVotingWindowStatus(window: VotingWindow, now = new Date()): VotingWindowStatus {
  const start = parseDateOrNull(window.start);
  const end = parseDateOrNull(window.end);

  if (start && now < start) {
    return { kind: "not_started", startsInMs: start.getTime() - now.getTime() };
  }
  if (end && now > end) {
    return { kind: "closed", endedMsAgo: now.getTime() - end.getTime() };
  }
  return { kind: "open", remainingMs: end ? end.getTime() - now.getTime() : null };
}

