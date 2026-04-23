"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminResultsPayload, AdminResultsTallyRow } from "@/lib/admin/results-tallies-types";

function sortRowsForReport(
  rows: AdminResultsTallyRow[],
  geoOrder: Map<number, number>,
): AdminResultsTallyRow[] {
  return [...rows].sort((a, b) => {
    const ga = a.geo_group_id ?? -1;
    const gb = b.geo_group_id ?? -1;
    const oa = geoOrder.get(ga) ?? 999;
    const ob = geoOrder.get(gb) ?? 999;
    if (oa !== ob) return oa - ob;
    const sa = a.sort_order ?? 0;
    const sb = b.sort_order ?? 0;
    if (sa !== sb) return sa - sb;
    return a.full_name.localeCompare(b.full_name);
  });
}

export function AdminResultsReport({ initial }: { initial: AdminResultsPayload }) {
  const [payload, setPayload] = useState<AdminResultsPayload>(initial);
  const [pollError, setPollError] = useState<string | null>(null);

  const geoOrder = useMemo(() => {
    const m = new Map<number, number>();
    (payload.geoGroups ?? []).forEach((g, i) => m.set(g.id, i));
    return m;
  }, [payload.geoGroups]);

  const sortedRows = useMemo(
    () => sortRowsForReport(payload.rows, geoOrder),
    [payload.rows, geoOrder],
  );

  const totalVotes = useMemo(
    () => sortedRows.reduce((acc, r) => acc + (Number.isFinite(r.vote_count) ? r.vote_count : 0), 0),
    [sortedRows],
  );

  const geoLabel = useCallback(
    (geoId: number | null) => {
      if (geoId == null) return "— Unassigned";
      const g = payload.geoGroups.find((x) => x.id === geoId);
      return g ? `${g.code} — ${g.name}` : `Geo #${geoId}`;
    },
    [payload.geoGroups],
  );

  const refresh = useCallback(async () => {
    setPollError(null);
    try {
      const res = await fetch("/api/admin/results-tallies", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const next = (await res.json()) as AdminResultsPayload;
      setPayload(next);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Unable to refresh.");
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  function openLiveTallies() {
    window.open("/admin/live-tallies", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Results</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Live vote totals for each candidate in the active conference. This view refreshes every few seconds.
            </p>
            {payload.activeConfcode ? (
              <p className="mt-2 text-xs text-neutral-500">
                Conference{" "}
                <span className="font-mono text-neutral-700">{payload.activeConfcode}</span>
                {payload.conferenceName ? (
                  <>
                    {" "}
                    <span className="text-neutral-400">·</span> {payload.conferenceName}
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-800">
                No active conference is set. Choose a confcode in Admin → Settings to see results.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            >
              Refresh now
            </button>
            <button
              type="button"
              onClick={openLiveTallies}
              disabled={!payload.activeConfcode}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Live tallies
            </button>
          </div>
        </div>

        {pollError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {pollError}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-neutral-400">
          Last updated {new Date(payload.fetchedAt).toLocaleString()} · Total votes recorded:{" "}
          <span className="font-medium text-neutral-600">{totalVotes}</span>
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Candidate report</div>
        <p className="mt-1 text-xs text-neutral-500">
          One row per candidate; counts include only submitted ballots.
        </p>

        {!payload.activeConfcode ? null : sortedRows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No candidates found for this conference.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="border-b px-2 py-2 font-medium">Candidate</th>
                  <th className="border-b px-2 py-2 font-medium">Geo</th>
                  <th className="border-b px-2 py-2 font-medium">Votes</th>
                  <th className="border-b px-2 py-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.candidate_id} className="hover:bg-neutral-50">
                    <td className="border-b px-2 py-2">
                      <div className="flex items-center gap-3">
                        {r.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.photo_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg border object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-lg border bg-neutral-100" />
                        )}
                        <span className="font-medium text-neutral-900">{r.full_name}</span>
                      </div>
                    </td>
                    <td className="border-b px-2 py-2 text-neutral-600">{geoLabel(r.geo_group_id)}</td>
                    <td className="border-b px-2 py-2 tabular-nums font-semibold text-neutral-900">
                      {r.vote_count}
                    </td>
                    <td className="border-b px-2 py-2 text-neutral-600">
                      {r.is_active === false ? "No" : "Yes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
