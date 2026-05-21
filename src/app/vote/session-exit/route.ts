import { NextResponse } from "next/server";
import {
  clearVotingSessionCookie,
  getVotingSessionIdFromCookie,
} from "@/lib/voting/session-cookie";
import { revertVotingSessionToQueuedIfVoting } from "@/lib/voting/revert-voting-session-to-queued";

const REASONS = ["closed", "unknown", "invalid", "expired"] as const;
type ExitReason = (typeof REASONS)[number];

function isExitReason(s: string | null): s is ExitReason {
  return s !== null && (REASONS as readonly string[]).includes(s);
}

/**
 * Clears the voting session cookie (and optionally reverts `voting` → `queued`) in a Route
 * Handler, then redirects to `/vote/login`. Invoked from `ensureVotingSessionInProgress` via
 * `redirect()` because `cookies().delete()` is not allowed during RSC render.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reasonRaw = url.searchParams.get("reason");
  const msg = url.searchParams.get("msg") ?? "";

  if (!isExitReason(reasonRaw)) {
    return NextResponse.redirect(new URL("/vote/login", request.url));
  }

  const reason = reasonRaw;
  const sessionId = await getVotingSessionIdFromCookie();
  const login = new URL("/vote/login", request.url);

  if (reason === "closed") {
    if (sessionId) await revertVotingSessionToQueuedIfVoting(sessionId);
    await clearVotingSessionCookie();
    login.searchParams.set("error", "closed");
    if (msg) login.searchParams.set("msg", msg);
    return NextResponse.redirect(login);
  }

  if (reason === "expired") {
    if (sessionId) await revertVotingSessionToQueuedIfVoting(sessionId);
    await clearVotingSessionCookie();
    login.searchParams.set("session_expired", "1");
    return NextResponse.redirect(login);
  }

  if (reason === "invalid") {
    if (sessionId) await revertVotingSessionToQueuedIfVoting(sessionId);
    await clearVotingSessionCookie();
    return NextResponse.redirect(login);
  }

  // unknown: transient eligibility failure — do not clear cookie or revert session
  login.searchParams.set("error", "unknown");
  if (msg) login.searchParams.set("msg", msg);
  return NextResponse.redirect(login);
}
