import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * If the row is still `voting`, revert it to `queued` and release any bound tablet.
 * Same behavior as `POST /vote/abandon-session` (without touching cookies).
 * Safe to call when the voter is being sent back to `/vote/login` (expiry, etc.).
 */
export async function revertVotingSessionToQueuedIfVoting(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId || sessionId === "dev-bypass") return;

  const supabase = createSupabaseServiceRoleClient();

  const { data: row, error: selErr } = await supabase
    .from("voting_sessions")
    .select("tablet_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (selErr || !row || row.status !== "voting") return;

  const tabletId = row.tablet_id as number | null;

  const { error: upErr } = await supabase
    .from("voting_sessions")
    .update({
      status: "queued",
      voted_via: null,
      session_start: null,
      session_end: null,
      tablet_id: null,
      skipped_at: null,
    })
    .eq("id", sessionId)
    .eq("status", "voting");

  if (upErr) {
    console.error("revertVotingSessionToQueuedIfVoting: update failed", upErr);
    return;
  }

  if (tabletId != null) {
    await supabase
      .from("tablets")
      .update({
        status: "vacant",
        current_session: null,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", tabletId);
  }
}
