"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import type { Candidate, Conference, GeoGroup } from "@/lib/db/types";
import { ConferenceBanner } from "./conference-banner";
import { GeoGroupSection } from "./geo-group-section";
import { confirmBallotSubmission } from "./actions";
import { SubmitButton } from "./submit-button";
import {
  clearVoteBallotSubmittingFlag,
  markVoteBallotSubmitting,
  useVoteLeaveGuard,
} from "./use-vote-leave-guard";

function candidatesForGeo(candidates: Candidate[], geoId: number) {
  return candidates.filter((c) => c.geo_group_id === geoId);
}

const REQUIRED_PICKS_PER_GEO_GROUP = 3;

export function maxSlotsForGroup(g: GeoGroup): number {
  // Voting rule: exactly 3 candidates per geo group.
  // Keep this independent of DB `max_votes` so the UI matches enforcement.
  void g;
  return REQUIRED_PICKS_PER_GEO_GROUP;
}

function buildInitialSelections(geoGroups: GeoGroup[]): Record<number, (string | null)[]> {
  const init: Record<number, (string | null)[]> = {};
  for (const g of geoGroups) {
    init[g.id] = Array.from({ length: maxSlotsForGroup(g) }, () => null);
  }
  return init;
}

type Props = {
  geoGroups: GeoGroup[];
  candidates: Candidate[];
  conference: Conference | null;
  activeConfcode: string | null;
};

export function VoteBallotFlow({
  geoGroups,
  candidates,
  conference,
  activeConfcode,
}: Props) {
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [selections, setSelections] = useState<Record<number, (string | null)[]>>(() =>
    buildInitialSelections(geoGroups),
  );
  const [confirmState, confirmAction] = useActionState(confirmBallotSubmission, null);

  useVoteLeaveGuard();

  useEffect(() => {
    if (confirmState?.error) clearVoteBallotSubmittingFlag();
  }, [confirmState?.error]);

  const byId = useMemo(
    () => Object.fromEntries(candidates.map((c) => [c.id, c])) as Record<string, Candidate>,
    [candidates],
  );

  const choicesPayload = useMemo(() => {
    return geoGroups.map((g) => ({
      geo_group_id: g.id,
      candidate_ids: (selections[g.id] ?? []).filter((id): id is string => id != null),
    }));
  }, [geoGroups, selections]);

  const summaryRows = useMemo(() => {
    return geoGroups.map((g) => {
      const ids = (selections[g.id] ?? []).filter((id): id is string => id != null);
      const names = ids.map((id) => byId[id]?.full_name ?? id);
      return { group: g, names };
    });
  }, [geoGroups, selections, byId]);

  const totalPicks = useMemo(
    () =>
      geoGroups.reduce(
        (acc, g) =>
          acc + (selections[g.id] ?? []).filter((id) => id != null).length,
        0,
      ),
    [geoGroups, selections],
  );

  const updateGroupSlots = useCallback((groupId: number, next: (string | null)[]) => {
    setSelections((s) => ({ ...s, [groupId]: next }));
  }, []);

  const canGoToReview = useMemo(() => {
    for (const g of geoGroups) {
      const pool = candidatesForGeo(candidates, g.id);
      if (pool.length === 0) continue;
      const filled = (selections[g.id] ?? []).filter(Boolean).length;
      if (filled !== REQUIRED_PICKS_PER_GEO_GROUP) return false;
    }
    return geoGroups.some((g) => (selections[g.id] ?? []).some(Boolean));
  }, [geoGroups, candidates, selections]);

  const canSubmit = canGoToReview;

  return (
    <div className="min-h-dvh bg-white font-sans text-black">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <ConferenceBanner conference={conference} activeConfcode={activeConfcode} />

        <header className="mb-8 text-center sm:mb-8 sm:text-left">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {step === "edit" ? "Cast your votes" : "Review your ballot"}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            {step === "edit"
              ? `Select exactly ${REQUIRED_PICKS_PER_GEO_GROUP} candidates in each region.`
              : "Confirm everything looks correct. You can go back to change your choices."}
          </p>
        </header>

        {geoGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-600">
            No active geographic regions are configured yet.
          </div>
        ) : step === "edit" ? (
          <>
            <ol className="grid list-none gap-6 p-0">
              {geoGroups.map((group) => (
                <li key={group.id}>
                  <GeoGroupSection
                    group={group}
                    candidates={candidatesForGeo(candidates, group.id)}
                    slots={selections[group.id] ?? []}
                    onSlotsChange={(next) => updateGroupSlots(group.id, next)}
                  />
                </li>
              ))}
            </ol>

            <div className="mt-10 border-t border-neutral-200 pt-8">
              {!canGoToReview ? (
                <p className="mb-4 text-center text-sm text-amber-800">
                  Choose exactly {REQUIRED_PICKS_PER_GEO_GROUP} candidates in every region that has
                  nominees, then continue to review.
                </p>
              ) : null}
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={!canGoToReview}
                  onClick={() => setStep("review")}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit — review ballot
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <section
              className="mb-10 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/30"
              aria-labelledby="review-heading"
            >
              <h3
                id="review-heading"
                className="text-lg font-semibold text-neutral-900 dark:text-slate-100"
              >
                Summary
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                {totalPicks} {totalPicks === 1 ? "choice" : "choices"} across{" "}
                {summaryRows.filter((r) => r.names.length > 0).length}{" "}
                {summaryRows.filter((r) => r.names.length > 0).length === 1 ? "region" : "regions"}.
              </p>
              <ul className="mt-5 space-y-5">
                {summaryRows.map(({ group, names }) => (
                  <li key={group.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">
                      {group.code ? `${group.code} · ` : ""}
                      {group.name}
                    </p>
                    {names.length === 0 ? (
                      <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">No selection</p>
                    ) : (
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-900 dark:text-slate-100">
                        {names.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <form
              action={confirmAction}
              className="space-y-4"
              onSubmit={() => {
                markVoteBallotSubmitting();
              }}
            >
              <input type="hidden" name="choices" value={JSON.stringify(choicesPayload)} />

              {confirmState?.error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {confirmState.error}
                </p>
              ) : null}

              {!canSubmit ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Your ballot must have exactly {REQUIRED_PICKS_PER_GEO_GROUP} selections per region
                  before submitting.
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep("edit")}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Back to edit
                </button>
                <SubmitButton
                  pendingLabel="Submitting…"
                  disabled={!canSubmit}
                  className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                >
                  Confirm submission
                </SubmitButton>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
