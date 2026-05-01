import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "phalga_voting_session";

/** Browser cookie lifetime after voter signs in (must match product expectation for `/vote`). */
const VOTING_SESSION_COOKIE_MAX_AGE_SEC = 60 * 30; // 30 minutes

export async function setVotingSessionCookie(votingSessionId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, votingSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VOTING_SESSION_COOKIE_MAX_AGE_SEC,
  });
}

export async function getVotingSessionIdFromCookie() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearVotingSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

