import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getVotingSessionIdFromCookie } from "@/lib/voting/session-cookie";
import { isVoteLoginBypassed } from "@/lib/voting/dev-bypass";
import { isVotingSessionPastMaxDuration } from "@/lib/voting/voting-session-duration";
import { getBallotSubmissionEligibility } from "@/lib/voting/voting-ballot-eligibility";

/**
 * `/vote` is only for an active `voting` session. Otherwise send the voter to login
 * (e.g. session was abandoned and reverted to `queued`).
 */
export async function ensureVotingSessionInProgress(): Promise<void> {
  if (isVoteLoginBypassed()) return;

  const el = await getBallotSubmissionEligibility();
  if (!el.ok) {
    const params = new URLSearchParams({
      reason: el.kind === "closed" ? "closed" : "unknown",
      msg: el.message,
    });
    redirect(`/vote/session-exit?${params.toString()}`);
  }

  const sessionId = await getVotingSessionIdFromCookie();
  if (!sessionId) redirect("/vote/login");

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("voting_sessions")
    .select("status, session_start")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data || data.status !== "voting") {
    redirect("/vote/session-exit?reason=invalid");
  }

  if (isVotingSessionPastMaxDuration(data.session_start as string | null)) {
    redirect("/vote/session-exit?reason=expired");
  }
}
