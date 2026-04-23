import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getVotingSessionIdFromCookie } from "@/lib/voting/session-cookie";
import { isVoteLoginBypassed } from "@/lib/voting/dev-bypass";

/**
 * `/vote` is only for an active `voting` session. Otherwise send the voter to login
 * (e.g. session was abandoned and reverted to `queued`).
 */
export async function ensureVotingSessionInProgress(): Promise<void> {
  if (isVoteLoginBypassed()) return;

  const sessionId = await getVotingSessionIdFromCookie();
  if (!sessionId) redirect("/vote/login");

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("voting_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data || data.status !== "voting") {
    redirect("/vote/login");
  }
}
