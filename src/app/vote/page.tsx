import { redirect } from "next/navigation";
import { getEffectiveVotingSessionId } from "@/lib/voting/dev-bypass";
import { ensureVotingSessionInProgress } from "@/lib/voting/ensure-vote-page-session";
import { getVotingPageData } from "@/lib/voting/vote-catalog";
import { VoteBallotFlow } from "./vote-ballot-flow";

/**
 * Geo sections from `public.geo_groups`; candidates from `public.candidates` for
 * `app_settings.active_confcode`, grouped by `geo_group_id`. Conference title from
 * `public.conference` via the active confcode.
 */
export default async function VoteHomePage() {
  const votingSessionId = await getEffectiveVotingSessionId();
  if (!votingSessionId) redirect("/vote/login");

  await ensureVotingSessionInProgress();

  const { geoGroups, conference, activeConfcode, candidates } = await getVotingPageData();

  return (
    <VoteBallotFlow
      geoGroups={geoGroups}
      candidates={candidates}
      conference={conference}
      activeConfcode={activeConfcode}
    />
  );
}
