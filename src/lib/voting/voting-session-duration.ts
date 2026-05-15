/** Max wall-clock time a voter may stay on `/vote` after `session_start` (matches cookie max-age). */
export const VOTING_SESSION_DURATION_SECONDS = 2 * 60 * 60;

export const VOTING_SESSION_DURATION_MS = VOTING_SESSION_DURATION_SECONDS * 1000;

/**
 * True when `session_start` is older than {@link VOTING_SESSION_DURATION_MS}.
 * Missing or unparseable `session_start` is not treated as expired (cookie still enforces TTL).
 */
export function isVotingSessionPastMaxDuration(
  sessionStartIso: string | null,
  nowMs: number = Date.now(),
): boolean {
  const raw = sessionStartIso?.trim();
  if (!raw) return false;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return false;
  return nowMs - t > VOTING_SESSION_DURATION_MS;
}
