/**
 * Normalize `voting_sessions.status` from PostgREST / Postgres for comparisons.
 * Handles casing, trim, and stray zero-width characters that break `=== "voting"`.
 */
export function normalizeVotingSessionStatus(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  return s;
}

export function isVotingSessionStatusVoting(raw: unknown): boolean {
  return normalizeVotingSessionStatus(raw) === "voting";
}

export function isVotingSessionStatusVoted(raw: unknown): boolean {
  return normalizeVotingSessionStatus(raw) === "voted";
}
