import "server-only";

import { getAppSettingsStatus } from "@/lib/admin/app-settings-status";
import { getVotingWindow, getVotingWindowStatus } from "@/lib/voting/voting-window";

/**
 * Ballots are accepted only when `app_settings.voting_status` is not `closed`
 * and the configured voting time window is open.
 */
export async function getBallotSubmissionEligibility(): Promise<
  | { ok: true }
  | { ok: false; kind: "closed"; message: string }
  | { ok: false; kind: "internal"; message: string }
> {
  const votingStatus = await getAppSettingsStatus();
  if (votingStatus === "closed") {
    return { ok: false, kind: "closed", message: "Voting is currently closed." };
  }

  try {
    const window = await getVotingWindow();
    const wStatus = getVotingWindowStatus(window);
    if (wStatus.kind !== "open") {
      return { ok: false, kind: "closed", message: "Voting is currently closed." };
    }
  } catch {
    return {
      ok: false,
      kind: "internal",
      message: "Unable to validate voting window right now. Please try again.",
    };
  }

  return { ok: true };
}
