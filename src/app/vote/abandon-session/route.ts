import { NextResponse } from "next/server";
import { clearVotingSessionCookie, getVotingSessionIdFromCookie } from "@/lib/voting/session-cookie";
import { revertVotingSessionToQueuedIfVoting } from "@/lib/voting/revert-voting-session-to-queued";

/**
 * Called when the voter leaves /vote without submitting (tab close, refresh, navigation).
 * Lives under `/vote/*` so the scoped `phalga_voting_session` cookie (path `/vote`) is sent.
 * Reverts `voting` → `queued`, frees the tablet if any, and clears the session cookie.
 * No-op if session is already `voted` or not in `voting`.
 */
export async function POST() {
  const sessionId = await getVotingSessionIdFromCookie();

  if (!sessionId || sessionId === "dev-bypass") {
    return new NextResponse(null, { status: 204 });
  }

  await revertVotingSessionToQueuedIfVoting(sessionId);
  await clearVotingSessionCookie();

  return NextResponse.json({ ok: true });
}
