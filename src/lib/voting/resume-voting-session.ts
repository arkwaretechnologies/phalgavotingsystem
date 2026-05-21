import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isVotingSessionStatusVoting } from "@/lib/voting/normalize-voting-session-status";
import { isVotingSessionPastMaxDuration } from "@/lib/voting/voting-session-duration";
import { revertVotingSessionToQueuedIfVoting } from "@/lib/voting/revert-voting-session-to-queued";

export type TryResumeVotingSessionResult =
  | { kind: "resume"; sessionId: string }
  | { kind: "already_submitted" }
  | { kind: "not_applicable" };

type ResumeParams = {
  queueNumber: number;
  token: string;
  tabletId: number | null;
  votedVia: "tablet" | "phone";
};

async function ballotAlreadySubmitted(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  sessionId: string,
  voterId: string | null,
): Promise<boolean> {
  if (voterId) {
    const { data: ballot } = await supabase
      .from("ballots")
      .select("is_submitted")
      .eq("voter_id", voterId)
      .maybeSingle();
    return Boolean((ballot as { is_submitted?: boolean | null } | null)?.is_submitted);
  }
  const { data: ballot } = await supabase
    .from("ballots")
    .select("is_submitted")
    .eq("session_id", sessionId)
    .maybeSingle();
  return Boolean((ballot as { is_submitted?: boolean | null } | null)?.is_submitted);
}

/**
 * Resume an in-progress `voting` session when the voter re-enters queue number + token
 * (e.g. network failed after verify). Requires ballot not yet submitted.
 */
export async function tryResumeVotingSession(
  params: ResumeParams,
): Promise<TryResumeVotingSessionResult> {
  const supabase = createSupabaseServiceRoleClient();
  const { queueNumber, token, tabletId, votedVia } = params;

  const { data: session, error: sErr } = await supabase
    .from("voting_sessions")
    .select("id, status, voter_id, session_start")
    .eq("queue_number", queueNumber)
    .eq("token", token)
    .maybeSingle();

  if (sErr || !session?.id || !isVotingSessionStatusVoting(session.status)) {
    return { kind: "not_applicable" };
  }

  const sessionId = String(session.id);
  const voterId = (session as { voter_id?: string | null }).voter_id ?? null;

  if (await ballotAlreadySubmitted(supabase, sessionId, voterId)) {
    return { kind: "already_submitted" };
  }

  const sessionStart = (session as { session_start?: string | null }).session_start ?? null;
  if (isVotingSessionPastMaxDuration(sessionStart)) {
    await revertVotingSessionToQueuedIfVoting(sessionId);
    return { kind: "not_applicable" };
  }

  const sessionUpdate: Record<string, unknown> = {
    voted_via: votedVia,
    tablet_id: tabletId,
  };
  if (!sessionStart?.trim()) {
    sessionUpdate.session_start = new Date().toISOString();
  }

  const { error: upErr } = await supabase
    .from("voting_sessions")
    .update(sessionUpdate)
    .eq("id", sessionId)
    .eq("status", "voting");
  if (upErr) {
    console.error("tryResumeVotingSession: session update failed", upErr);
    return { kind: "not_applicable" };
  }

  if (tabletId != null) {
    const { error: tErr } = await supabase
      .from("tablets")
      .update({
        status: "in_use",
        current_session: sessionId,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", tabletId);
    if (tErr) {
      console.error("tryResumeVotingSession: tablet bind failed", tErr);
    }
  }

  return { kind: "resume", sessionId };
}
