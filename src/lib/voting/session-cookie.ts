import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "phalga_voting_session";

export async function setVotingSessionCookie(votingSessionId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, votingSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60, // 1 hour
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

