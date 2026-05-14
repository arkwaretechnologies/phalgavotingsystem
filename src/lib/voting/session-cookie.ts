import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "phalga_voting_session";

/** Scope to `/vote` so admin routes are not sent this cookie (smaller `Cookie` header on `/admin/*`). */
const VOTING_SESSION_COOKIE_PATH = "/vote";

/** Browser cookie lifetime after voter signs in (must match product expectation for `/vote`). */
const VOTING_SESSION_COOKIE_MAX_AGE_SEC = 60 * 30; // 30 minutes

export async function setVotingSessionCookie(votingSessionId: string) {
  const store = await cookies();
  // Drop legacy path="/" cookie from older deploys so it does not keep bloating admin requests.
  store.delete({ name: COOKIE_NAME, path: "/" });
  store.set(COOKIE_NAME, votingSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: VOTING_SESSION_COOKIE_PATH,
    maxAge: VOTING_SESSION_COOKIE_MAX_AGE_SEC,
  });
}

export async function getVotingSessionIdFromCookie() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearVotingSessionCookie() {
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: VOTING_SESSION_COOKIE_PATH });
  store.delete({ name: COOKIE_NAME, path: "/" });
}

