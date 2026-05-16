import "server-only";
import { cookies } from "next/headers";
import { VOTING_SESSION_DURATION_SECONDS } from "@/lib/voting/voting-session-duration";
import { shouldUseSecureCookies } from "@/lib/security/cookies";

const COOKIE_NAME = "phalga_voting_session";

/** Scope to `/vote` so admin routes are not sent this cookie (smaller `Cookie` header on `/admin/*`). */
const VOTING_SESSION_COOKIE_PATH = "/vote";

export async function setVotingSessionCookie(votingSessionId: string) {
  const store = await cookies();
  // Drop legacy path="/" cookie from older deploys so it does not keep bloating admin requests.
  store.delete({ name: COOKIE_NAME, path: "/" });
  store.set(COOKIE_NAME, votingSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: VOTING_SESSION_COOKIE_PATH,
    maxAge: VOTING_SESSION_DURATION_SECONDS,
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

