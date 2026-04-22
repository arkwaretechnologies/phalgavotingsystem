import { redirect } from "next/navigation";
import { getEffectiveVotingSessionId } from "@/lib/voting/dev-bypass";
import { getVotingPageData } from "@/lib/voting/vote-catalog";
import type { Candidate } from "@/lib/db/types";
import { ConferenceBanner } from "./conference-banner";
import { GeoGroupSection } from "./geo-group-section";

function candidatesForGeo(candidates: Candidate[], geoId: number) {
  return candidates.filter((c) => c.geo_group_id === geoId);
}

/**
 * Geo sections from `public.geo_groups`; candidates from `public.candidates` for
 * `app_settings.active_confcode`, grouped by `geo_group_id`. Conference title from
 * `public.conference` via the active confcode.
 */
export default async function VoteHomePage() {
  const votingSessionId = await getEffectiveVotingSessionId();
  if (!votingSessionId) redirect("/vote/login");

  const { geoGroups, conference, activeConfcode, candidates } = await getVotingPageData();

  return (
    <div className="min-h-dvh bg-white font-sans text-black">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <ConferenceBanner conference={conference} activeConfcode={activeConfcode} />

        <header className="mb-8 text-center sm:mb-8 sm:text-left">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Cast your votes
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Select up to the allowed number of candidates in each region.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Session{" "}
            <span className="font-mono text-neutral-700">{votingSessionId}</span>
          </p>
        </header>

        {geoGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-600">
            No active geographic regions are configured yet.
          </div>
        ) : (
          <ol className="grid list-none gap-6 p-0">
            {geoGroups.map((group) => (
              <li key={group.id}>
                <GeoGroupSection
                  group={group}
                  candidates={candidatesForGeo(candidates, group.id)}
                />
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
