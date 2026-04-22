import "server-only";

import { getVotingSessionIdFromCookie } from "./session-cookie";

const MOCK_VOTING_SESSION_ID = "dev-bypass";

/**
 * When true, `/vote` does not require a real session cookie (local dev only).
 * Never enabled in production, even if the env var is set.
 */
export function isVoteLoginBypassed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const v = process.env.DEV_BYPASS_VOTE_LOGIN?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Resolves the voting session id: real cookie, or a mock id when the dev bypass is on.
 */
export async function getEffectiveVotingSessionId(): Promise<string | null> {
  if (isVoteLoginBypassed()) return MOCK_VOTING_SESSION_ID;
  return getVotingSessionIdFromCookie();
}
