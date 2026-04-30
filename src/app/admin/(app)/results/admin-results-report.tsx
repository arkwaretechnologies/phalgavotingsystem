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

type GeoFilter = "all" | "unassigned" | number;

export function AdminResultsReport({ initial }: { initial: AdminResultsPayload }) {
  const [payload, setPayload] = useState<AdminResultsPayload>(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const [geoFilter, setGeoFilter] = useState<GeoFilter>("all");

  const geoOrder = useMemo(() => {
    const m = new Map<number, number>();
    (payload.geoGroups ?? []).forEach((g, i) => m.set(g.id, i));
    return m;
  }, [payload.geoGroups]);

  const sortedRows = useMemo(
    () => sortRowsForReport(payload.rows, geoOrder),
    [payload.rows, geoOrder],
  );

  const filteredRows = useMemo(() => {
    if (geoFilter === "all") return sortedRows;
    if (geoFilter === "unassigned") return sortedRows.filter((r) => r.geo_group_id == null);
    return sortedRows.filter((r) => r.geo_group_id === geoFilter);
  }, [sortedRows, geoFilter]);

  const totalVotes = useMemo(
    () => sortedRows.reduce((acc, r) => acc + (Number.isFinite(r.vote_count) ? r.vote_count : 0), 0),
    [sortedRows],
  );

  /** Counts per geo across the *unfiltered* rows so chips always show real totals. */
  const countsByGeo = useMemo(() => {
    const m = new Map<number | "unassigned", { rows: number; votes: number }>();
    let unRows = 0;
    let unVotes = 0;
    for (const r of sortedRows) {
      if (r.geo_group_id == null) {
        unRows += 1;
        unVotes += Number.isFinite(r.vote_count) ? r.vote_count : 0;
        continue;
      }
      const cur = m.get(r.geo_group_id) ?? { rows: 0, votes: 0 };
      cur.rows += 1;
      cur.votes += Number.isFinite(r.vote_count) ? r.vote_count : 0;
      m.set(r.geo_group_id, cur);
    }
    if (unRows > 0) m.set("unassigned", { rows: unRows, votes: unVotes });
    return m;
  }, [sortedRows]);

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
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Results</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Live vote totals for each candidate in the active conference. This view refreshes every few seconds.
            </p>
            {payload.activeConfcode ? (
              <p className="mt-2 text-xs text-neutral-600">
                Conference{" "}
                <span className="font-mono text-neutral-700">{payload.activeConfcode}</span>
                {payload.conferenceName ? (
                  <>
                    {" "}
                    <span className="text-neutral-500">·</span> {payload.conferenceName}
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
              onClick={openLiveTallies}
              disabled={!payload.activeConfcode}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              View Final Tallies
            </button>
          </div>
        </div>

        {pollError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {pollError}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-neutral-500">
          Last updated {new Date(payload.fetchedAt).toLocaleString()} · Total votes recorded:{" "}
          <span className="font-medium text-neutral-600">{totalVotes}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Candidate report</div>
            <p className="mt-1 text-xs text-neutral-600">
              One row per candidate; counts include only submitted ballots.
            </p>
          </div>
          <div className="text-xs text-neutral-500">
            Showing{" "}
            <span className="font-medium text-neutral-700">{filteredRows.length}</span> of{" "}
            <span className="font-medium text-neutral-700">{sortedRows.length}</span> candidates
          </div>
        </div>

        {payload.activeConfcode && payload.geoGroups.length > 0 ? (
          <div
            className="mt-4 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter candidates by geo group"
          >
            <FilterChip
              label="All"
              count={sortedRows.length}
              active={geoFilter === "all"}
              onClick={() => setGeoFilter("all")}
            />
            {payload.geoGroups.map((g) => {
              const c = countsByGeo.get(g.id);
              return (
                <FilterChip
                  key={g.id}
                  label={`${g.code} — ${g.name}`}
                  count={c?.rows ?? 0}
                  active={geoFilter === g.id}
                  onClick={() => setGeoFilter(g.id)}
                />
              );
            })}
            {countsByGeo.has("unassigned") ? (
              <FilterChip
                label="Unassigned"
                count={countsByGeo.get("unassigned")?.rows ?? 0}
                active={geoFilter === "unassigned"}
                onClick={() => setGeoFilter("unassigned")}
              />
            ) : null}
          </div>
        ) : null}

        {!payload.activeConfcode ? null : sortedRows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No candidates found for this conference.</p>
        ) : filteredRows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">
            No candidates match the selected filter.
          </p>
        ) : (
          <div className="admin-table-wrap mt-4">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Geo</th>
                  <th className="text-right">Votes</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.candidate_id}>
                    <td>
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
                    <td className="text-neutral-600">{geoLabel(r.geo_group_id)}</td>
                    <td className="text-right tabular-nums font-semibold text-neutral-900">
                      {r.vote_count}
                    </td>
                    <td className="text-neutral-600">{r.is_active === false ? "No" : "Yes"}</td>
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

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-black bg-black text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
          active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
