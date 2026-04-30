"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminResultsPayload, AdminResultsTallyRow } from "@/lib/admin/results-tallies-types";

type GeoSection = {
  key: string;
  title: string;
  subtitle: string;
  sortKey: number;
  rows: AdminResultsTallyRow[];
};

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function IconArrowsExpand({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
      />
    </svg>
  );
}

function IconArrowsCollapse({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0 4.5l5.25 5.25"
      />
    </svg>
  );
}

/** Geo cards are laid out in a fixed four-column grid (rows grow as needed). */
const LIVE_TALLY_GRID_COLS = 4;

function liveTallyGridRows(sectionCount: number) {
  if (sectionCount <= 0) return 1;
  return Math.ceil(sectionCount / LIVE_TALLY_GRID_COLS);
}

function buildGeoSections(payload: AdminResultsPayload): GeoSection[] {
  const byId = new Map(payload.geoGroups.map((g) => [g.id, g]));
  const buckets = new Map<string, { meta: GeoSection; rows: AdminResultsTallyRow[] }>();

  function ensure(key: string, init: GeoSection) {
    let b = buckets.get(key);
    if (!b) {
      b = { meta: init, rows: [] };
      buckets.set(key, b);
    }
    return b;
  }

  for (const g of payload.geoGroups) {
    ensure(`g:${g.id}`, {
      key: `g:${g.id}`,
      title: g.name,
      subtitle: g.code,
      sortKey: g.sort_order ?? g.id,
      rows: [],
    });
  }

  for (const r of payload.rows) {
    if (r.geo_group_id == null) {
      const b = ensure("unassigned", {
        key: "unassigned",
        title: "Unassigned geo",
        subtitle: "Candidates not linked to a geo group",
        sortKey: 1_000_000,
        rows: [],
      });
      b.rows.push(r);
      continue;
    }
    const g = byId.get(r.geo_group_id);
    const sortKey = g?.sort_order ?? r.geo_group_id;
    const b = ensure(`g:${r.geo_group_id}`, {
      key: `g:${r.geo_group_id}`,
      title: g ? g.name : `Geo ${r.geo_group_id}`,
      subtitle: g ? g.code : "—",
      sortKey,
      rows: [],
    });
    b.rows.push(r);
  }

  for (const b of buckets.values()) {
    b.rows.sort((a, b) => {
      const sa = a.sort_order ?? 0;
      const sb = b.sort_order ?? 0;
      if (sa !== sb) return sa - sb;
      return b.vote_count - a.vote_count || a.full_name.localeCompare(b.full_name);
    });
  }

  return [...buckets.values()]
    .map((x) => ({ ...x.meta, rows: x.rows }))
    .sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title));
}

export function LiveTalliesBoard() {
  const [payload, setPayload] = useState<AdminResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/results-tallies", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Unable to load (${res.status})`);
      }
      setPayload((await res.json()) as AdminResultsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load tallies.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore unsupported / denied
    }
  }, []);

  const sections = useMemo(() => (payload ? buildGeoSections(payload) : []), [payload]);
  const gridRows = useMemo(() => liveTallyGridRows(sections.length), [sections.length]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-lg text-rose-200">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-300">
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400"
            aria-hidden
          />
          Loading live tallies…
        </div>
      </div>
    );
  }

  if (!payload.activeConfcode) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-8 text-center">
        <p className="max-w-lg text-lg text-slate-200">
          No active conference is configured. Set the active confcode in Admin → Settings, then open Live tallies
          again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-3">
      <header className="flex shrink-0 flex-col gap-2 border-b border-white/10 pb-2 sm:flex-row sm:items-center sm:justify-between sm:pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90 sm:text-xs">
            PhALGA
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
            Final Vote Tallies
          </h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">
            {payload.conferenceName ? (
              <span>{payload.conferenceName}</span>
            ) : (
              <span className="font-mono text-slate-300">{payload.activeConfcode}</span>
            )}
            <span className="mx-1.5 text-zinc-400">·</span>
            <span className="tabular-nums">{new Date(payload.fetchedAt).toLocaleString()}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => void load()}
            title="Refresh"
            aria-label="Refresh tallies"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 sm:h-10 sm:w-10"
          >
            <IconRefresh className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 hover:bg-sky-400 sm:h-10 sm:w-10"
          >
            {fullscreen ? (
              <IconArrowsCollapse className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
            ) : (
              <IconArrowsExpand className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
            )}
          </button>
        </div>
      </header>

      <main
        className="mt-2 min-h-0 flex-1 gap-2 sm:gap-3"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${LIVE_TALLY_GRID_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
          gridAutoFlow: "row",
        }}
      >
        {sections.length === 0 ? (
          <p className="col-span-4 self-center text-center text-sm text-slate-400">
            No candidates to display for this conference.
          </p>
        ) : (
          sections.map((section) => (
            <GeoTallyCard
              key={section.key}
              section={section}
              totalVoters={payload.totalVoters}
            />
          ))
        )}
      </main>
    </div>
  );
}

function barWidthPercent(voteCount: number, totalVoters: number): number {
  if (totalVoters <= 0 || voteCount <= 0) return 0;
  return Math.min(100, (voteCount / totalVoters) * 100);
}

/** Vote count descending; name breaks ties (stable ordering for the numbered list). */
function rowsRankedByVotes(rows: AdminResultsTallyRow[]) {
  return [...rows].sort((a, b) => b.vote_count - a.vote_count || a.full_name.localeCompare(b.full_name));
}

function CandidateRow({
  rank,
  r,
  totalVoters,
}: {
  rank: number;
  r: AdminResultsTallyRow;
  totalVoters: number;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 sm:gap-3.5">
      <span
        className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] px-1.5 text-sm font-bold tabular-nums text-zinc-200 ring-1 ring-white/10 sm:h-10 sm:min-w-10 sm:text-base"
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
      {r.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.photo_url}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl border border-white/15 object-cover shadow-md shadow-black/20 sm:h-[4.5rem] sm:w-[4.5rem] md:h-20 md:w-20"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-800 text-lg font-semibold text-zinc-400 shadow-md shadow-black/20 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-xl md:h-20 md:w-20 md:text-2xl">
          {r.full_name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-white sm:text-sm">{r.full_name}</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-base font-bold tabular-nums text-sky-300 sm:text-lg">{r.vote_count}</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800 sm:h-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-[width] duration-700 ease-out"
              style={{
                width: `${barWidthPercent(r.vote_count, totalVoters)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GeoTallyCard({
  section,
  totalVoters,
}: {
  section: GeoSection;
  totalVoters: number;
}) {
  const ranked = useMemo(() => rowsRankedByVotes(section.rows), [section.rows]);
  const prevRankByIdRef = useRef<Map<string, number>>(new Map());
  const [overtakeHighlightIds, setOvertakeHighlightIds] = useState<readonly string[]>([]);

  useEffect(() => {
    const nextRanks = new Map<string, number>();
    ranked.forEach((r, i) => nextRanks.set(r.candidate_id, i + 1));

    if (ranked.length === 0) {
      prevRankByIdRef.current = new Map();
      setOvertakeHighlightIds([]);
      return;
    }

    const prev = prevRankByIdRef.current;
    const movers: string[] = [];
    if (prev.size > 0) {
      for (const [id, newRank] of nextRanks) {
        const oldRank = prev.get(id);
        if (oldRank !== undefined && newRank < oldRank) {
          movers.push(id);
        }
      }
    }

    prevRankByIdRef.current = nextRanks;

    if (movers.length === 0) return;

    setOvertakeHighlightIds(movers);
    const t = window.setTimeout(() => setOvertakeHighlightIds([]), 6000);
    return () => window.clearTimeout(t);
  }, [ranked]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 shadow-lg shadow-black/30 backdrop-blur-md sm:rounded-2xl">
      <div className="shrink-0 border-b border-white/10 bg-slate-900/80 px-2 py-1.5 sm:px-3 sm:py-2">
        <h2 className="truncate text-sm font-semibold text-white sm:text-base">{section.title}</h2>
        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-400 sm:text-xs">
          {section.subtitle}
        </p>
      </div>

      {section.rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 py-8 text-center text-xs text-zinc-400 sm:text-sm">
          No candidates in this geo.
        </div>
      ) : (
        <div className="live-tally-rest-list min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-white/5">
          {ranked.map((r, i) => (
            <div
              key={r.candidate_id}
              className={
                overtakeHighlightIds.includes(r.candidate_id)
                  ? "live-tally-row--overtake px-2 py-2 sm:px-3 sm:py-2.5"
                  : "px-2 py-2 sm:px-3 sm:py-2.5"
              }
            >
              <CandidateRow rank={i + 1} r={r} totalVoters={totalVoters} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
