"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardSnapshot } from "@/lib/admin/dashboard-snapshot-types";

const ACCENT = "#0038a8";
const ACCENT_RED = "#ce1126";

const dashboardQuickLinkBase =
  "group relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight transition-[transform,box-shadow,background-color,border-color,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0038a8]/30 focus-visible:ring-offset-2";

function IconChartBars({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M4 19h3v-8H4v8zm6 0h3V5h-3v14zm6 0h3v-6h-3v6z" opacity="0.92" />
    </svg>
  );
}

function IconQueueList({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm4-10h12v2H8V6zm0 5h12v2H8v-2zm0 5h12v2H8v-2z" opacity="0.92" />
    </svg>
  );
}

function IconOpenNew({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  );
}

function formatPct(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return ((part / whole) * 100).toFixed(1);
}

function TurnoutRing({
  voted,
  total,
  label,
}: {
  voted: number;
  total: number;
  label: string;
}) {
  const r = 52;
  const stroke = 10;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, voted / total) : 0;
  const offset = c * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[130px] w-[130px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={stroke}
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={ACCENT}
            strokeWidth={stroke}
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums text-neutral-900">
            {formatPct(voted, total)}%
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            turnout
          </span>
        </div>
      </div>
      <p className="max-w-[14rem] text-center text-xs text-neutral-600">{label}</p>
    </div>
  );
}

function HorizontalBars({
  items,
  colors,
}: {
  items: { key: string; label: string; count: number }[];
  colors: Record<string, string>;
}) {
  const max = useMemo(() => Math.max(1, ...items.map((i) => i.count)), [items]);
  return (
    <ul className="space-y-3" aria-label="Bar chart">
      {items.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-neutral-800">{row.label}</span>
            <span className="tabular-nums text-neutral-600">{row.count}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(row.count / max) * 100}%`,
                backgroundColor: colors[row.key] ?? ACCENT,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function GeoTopThreeCard({
  geoCode,
  geoName,
  topThree,
}: {
  geoCode: string;
  geoName: string;
  topThree: { candidateName: string; voteCount: number }[];
}) {
  const max = Math.max(1, ...topThree.map((t) => t.voteCount));
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="mb-3 border-b border-neutral-200/80 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {geoCode}
        </div>
        <div className="text-sm font-semibold text-neutral-900">{geoName}</div>
      </div>
      {topThree.length === 0 ? (
        <p className="text-xs text-neutral-500">No votes recorded yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {topThree.map((t, i) => (
            <li key={`${t.candidateName}-${i}`}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-neutral-800">
                  <span className="mr-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ph-flag-blue)] text-[10px] text-white">
                    {i + 1}
                  </span>
                  {t.candidateName}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-600">{t.voteCount}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-neutral-200/80">
                <div
                  className="h-full rounded bg-neutral-800 transition-all duration-500"
                  style={{ width: `${(t.voteCount / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SESSION_COLORS: Record<string, string> = {
  queued: "#52525b",
  voting: "#ca8a04",
  voted: "#15803d",
};

const TABLET_COLORS: Record<string, string> = {
  vacant: "#15803d",
  in_use: "#0369a1",
  offline: "#a3a3a3",
};

function formatHHMMSS(ms: number | null): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatManila(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, { timeZone: "Asia/Manila" });
}

/** Active `voting` sessions split by `voted_via`. */
const ACTIVE_CHANNEL_COLORS: Record<string, string> = {
  tablet: "#0369a1",
  phone: "#7c3aed",
};

function SquareStatCard({
  title,
  value,
  subvalue,
  footnote,
}: {
  title: string;
  value: ReactNode;
  subvalue?: string;
  footnote?: string;
}) {
  return (
    <div className="admin-card-in flex h-24 w-24 shrink-0 flex-col gap-0.5 rounded-xl border border-neutral-200/80 bg-white p-2 shadow-sm sm:h-28 sm:w-28 sm:p-2.5">
      <div className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-neutral-500 sm:text-[10px]">
        {title}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        <div className="text-lg font-bold tabular-nums leading-none tracking-tight text-neutral-900 sm:text-xl">
          {value}
        </div>
        {subvalue ? (
          <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-neutral-600 sm:text-[11px]">
            {subvalue}
          </p>
        ) : null}
      </div>
      {footnote ? (
        <p className="text-[9px] leading-snug text-neutral-500 sm:text-[10px]">{footnote}</p>
      ) : null}
    </div>
  );
}

export function DashboardCharts({ initial }: { initial: DashboardSnapshot }) {
  const [data, setData] = useState<DashboardSnapshot>(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  // Avoid SSR/client hydration mismatch: server & initial client render must match.
  // We start ticking only after mount.
  const [nowTick, setNowTick] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setPollError(null);
    try {
      const res = await fetch("/api/admin/dashboard-snapshot", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const next = (await res.json()) as DashboardSnapshot;
      setData(next);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Unable to refresh.");
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Smooth countdown updates (1s) without refetching.
  useEffect(() => {
    setNowTick(Date.now());
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const turnoutLabel = data.activeConfcode
    ? `Submitted ballots for ${data.activeConfcode} vs. total names on the voter roll.`
    : "Set an active conference in Settings to tie ballots to a confcode. Turnout uses the full voter roll as the denominator.";

  const remaining = Math.max(0, data.totalVoters - data.votedVoters);
  const fetchedAtMs = useMemo(() => {
    const d = new Date(data.fetchedAt);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }, [data.fetchedAt]);

  const liveWindowMsRemaining = useMemo(() => {
    const base = data.votingWindow.msRemaining;
    if (base == null) return null;
    if (nowTick == null) return base;
    const anchor = fetchedAtMs ?? nowTick;
    const elapsed = Math.max(0, nowTick - anchor);
    return Math.max(0, base - elapsed);
  }, [data.votingWindow.msRemaining, nowTick, fetchedAtMs]);

  const windowLabel =
    data.votingWindow.status === "open"
      ? "Voting ends in"
      : data.votingWindow.status === "not_started"
        ? "Voting starts in"
        : "Voting closed";
  const windowValue =
    data.votingWindow.status === "closed"
      ? "Closed"
      : data.votingWindow.status === "open" && data.votingWindow.msRemaining == null
        ? "Open"
        : data.votingWindow.status === "not_started" && data.votingWindow.msRemaining == null
          ? "Scheduled"
          : formatHHMMSS(liveWindowMsRemaining);

  const sessionItems = data.sessionStatusCounts.map((s) => ({
    key: s.status,
    label: s.label,
    count: s.count,
  }));

  const tabletItems = data.tabletStatusCounts.map((s) => ({
    key: s.status,
    label: s.label,
    count: s.count,
  }));

  const vacantCount =
    data.tabletStatusCounts.find((t) => t.status === "vacant")?.count ?? 0;

  const inUseCount =
    data.tabletStatusCounts.find((t) => t.status === "in_use")?.count ?? 0;
  const offlineCount =
    data.tabletStatusCounts.find((t) => t.status === "offline")?.count ?? 0;

  const activeChannelSub =
    data.votingQueueNumbers.length === 0
      ? "No one is on a ballot right now."
      : `Station ${data.activeVotingAtStations} · Own device ${data.activeVotingOnOwnDevices}`;

  const activeFootnote =
    data.activeVotingChannelUnknown > 0
      ? `${data.activeVotingChannelUnknown} with no channel logged.`
      : undefined;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(5,2,3,0.08),transparent)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
              You are signed in. Use the shortcuts below or the sidebar to run check-in, manage data, and
              open final tallies after voting status is closed.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:justify-end">
            {data.electionVotingOpen ? (
              <span
                className={`${dashboardQuickLinkBase} cursor-not-allowed border border-neutral-200/60 bg-neutral-50 text-neutral-500 opacity-70 shadow-none`}
                title="Final tallies open in a new tab after voting status is set to closed (e.g. Canvass → Initiate Final Tally)."
                aria-disabled="true"
              >
                <IconChartBars className="shrink-0 text-neutral-400" />
                <span>View Final Tallies</span>
                <IconOpenNew className="shrink-0 text-neutral-300" />
              </span>
            ) : (
              <a
                href="/admin/live-tallies"
                target="_blank"
                rel="noopener noreferrer"
                className={`${dashboardQuickLinkBase} border border-neutral-200/90 bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] active:shadow-[0_1px_2px_rgba(0,0,0,0.06)]`}
              >
                <IconChartBars className="shrink-0 text-neutral-600 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-110 motion-safe:group-hover:text-neutral-900" />
                <span>View Final Tallies</span>
                <IconOpenNew className="shrink-0 text-neutral-400 transition-all duration-200 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:text-neutral-600" />
              </a>
            )}
            <a
              href="/queue-display"
              target="_blank"
              rel="noopener noreferrer"
              className={`${dashboardQuickLinkBase} ph-brand-button`}
            >
              <IconQueueList className="shrink-0 text-white/85 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-110 motion-safe:group-hover:text-white" />
              <span>View queueing</span>
              <IconOpenNew className="shrink-0 text-white/50 transition-all duration-200 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:text-white/85" />
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        <SquareStatCard
          title="Voter turnout"
          value={`${formatPct(data.votedVoters, data.totalVoters)}%`}
          subvalue={`${data.votedVoters} voted · ${data.totalVoters} on roll`}
        />
        <SquareStatCard
          title="In queue"
          value={data.queuedNumbersVerified.length}
          subvalue="Verified, waiting for a station"
        />
        <SquareStatCard
          title="Actively voting"
          value={data.votingQueueNumbers.length}
          subvalue={activeChannelSub}
          footnote={activeFootnote}
        />
        <SquareStatCard
          title="At stations"
          value={data.activeVotingAtStations}
          subvalue="Tablet booths (now)"
        />
        <SquareStatCard
          title="Own devices"
          value={data.activeVotingOnOwnDevices}
          subvalue="Phone / QR (now)"
        />
        <SquareStatCard
          title="Stations free"
          value={vacantCount}
          subvalue={`${inUseCount} in use · ${offlineCount} offline`}
        />
        <SquareStatCard
          title={windowLabel}
          value={windowValue}
          subvalue={
            data.votingWindow.start || data.votingWindow.end
              ? `${data.votingWindow.start ? `Start: ${formatManila(data.votingWindow.start)}` : ""}${data.votingWindow.start && data.votingWindow.end ? " · " : ""}${data.votingWindow.end ? `End: ${formatManila(data.votingWindow.end)}` : ""}`
              : "No voting window set"
          }
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Live overview</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Updates every 5 seconds. Last refreshed{" "}
            {new Date(data.fetchedAt).toLocaleTimeString(undefined, {
              timeStyle: "short",
            })}
            .
          </p>
          {pollError ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {pollError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          Refresh now
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Voter turnout</h3>
          <p className="mt-1 text-xs text-neutral-600">
            Voted (submitted ballots) / total on roll
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around sm:gap-6">
            <TurnoutRing
              voted={data.votedVoters}
              total={data.totalVoters}
              label={turnoutLabel}
            />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:min-w-[200px]">
              <div className="rounded-lg bg-neutral-50 px-3 py-2">
                <dt className="text-xs text-neutral-500">Voted</dt>
                <dd className="text-lg font-semibold tabular-nums text-neutral-900">
                  {data.votedVoters}
                </dd>
              </div>
              <div className="rounded-lg bg-neutral-50 px-3 py-2">
                <dt className="text-xs text-neutral-500">Not yet</dt>
                <dd className="text-lg font-semibold tabular-nums text-neutral-900">
                  {remaining}
                </dd>
              </div>
              <div className="col-span-2 rounded-lg border border-neutral-200/80 px-3 py-2">
                <dt className="text-xs text-neutral-500">Roll total</dt>
                <dd className="text-lg font-semibold tabular-nums text-neutral-900">
                  {data.totalVoters}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Sessions by status</h3>
          <p className="mt-1 text-xs text-neutral-600">
            Queue, active booths, and completed sessions
          </p>
          <div className="mt-4">
            <HorizontalBars items={sessionItems} colors={SESSION_COLORS} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Queue & active voting</h3>
          <p className="mt-1 text-xs text-neutral-600">
            Verified waiting numbers match the{" "}
            <Link href="/admin/queueing" className="font-medium text-[var(--ph-flag-blue)] underline-offset-2 hover:underline">
              Queueing
            </Link>{" "}
            screen.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-neutral-50 px-3 py-2">
              <dt className="text-xs text-neutral-500">Waiting (queued)</dt>
              <dd className="text-xl font-semibold tabular-nums text-neutral-900">
                {data.queuedNumbersVerified.length}
              </dd>
            </div>
            <div className="rounded-lg bg-neutral-50 px-3 py-2">
              <dt className="text-xs text-neutral-500">Actively voting (all)</dt>
              <dd className="text-xl font-semibold tabular-nums text-neutral-900">
                {data.votingQueueNumbers.length}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-neutral-100 bg-white p-3">
            <p className="text-xs font-medium text-neutral-800">Of those actively voting</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-sky-50/80 px-2.5 py-2">
                <dt className="text-[11px] text-sky-900/80">At stations (tablet)</dt>
                <dd className="text-lg font-semibold tabular-nums text-sky-950">
                  {data.activeVotingAtStations}
                </dd>
              </div>
              <div className="rounded-lg bg-violet-50/80 px-2.5 py-2">
                <dt className="text-[11px] text-violet-900/80">Own device (phone)</dt>
                <dd className="text-lg font-semibold tabular-nums text-violet-950">
                  {data.activeVotingOnOwnDevices}
                </dd>
              </div>
            </dl>
            {data.activeVotingAtStations + data.activeVotingOnOwnDevices > 0 ? (
              <div className="mt-3">
                <HorizontalBars
                  items={[
                    {
                      key: "tablet",
                      label: "Station (tablet)",
                      count: data.activeVotingAtStations,
                    },
                    {
                      key: "phone",
                      label: "Own device (phone)",
                      count: data.activeVotingOnOwnDevices,
                    },
                  ]}
                  colors={ACTIVE_CHANNEL_COLORS}
                />
              </div>
            ) : null}
            {data.activeVotingChannelUnknown > 0 ? (
              <p className="mt-2 text-xs text-amber-900">
                <span className="font-semibold tabular-nums">{data.activeVotingChannelUnknown}</span>{" "}
                active session
                {data.activeVotingChannelUnknown === 1 ? "" : "s"} with no channel recorded (legacy or
                in transition).
              </p>
            ) : null}
          </div>

          {data.queuedNumbersVerified.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-neutral-700">Next queue numbers</p>
              <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {data.queuedNumbersVerified.slice(0, 36).map((n) => (
                  <span
                    key={n}
                    className="inline-flex min-w-[2.25rem] justify-center rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-neutral-800"
                  >
                    {n}
                  </span>
                ))}
              </div>
              {data.queuedNumbersVerified.length > 36 ? (
                <p className="mt-2 text-xs text-neutral-500">
                  +{data.queuedNumbersVerified.length - 36} more in queue
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-600">No verified voters are queued.</p>
          )}
          {data.votingQueueNumbers.length > 0 ? (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <p className="text-xs font-medium text-neutral-700">Booths / sessions (voting)</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.votingQueueNumbers.map((n) => (
                  <span
                    key={n}
                    className="inline-flex min-w-[2.25rem] justify-center rounded-md bg-amber-100 px-2 py-1 font-mono text-xs font-semibold text-amber-950"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Voting stations (tablets)</h3>
          <p className="mt-1 text-xs text-neutral-600">
            <span className="font-semibold tabular-nums text-emerald-800">{vacantCount}</span>{" "}
            station{vacantCount === 1 ? "" : "s"} currently available (vacant).{" "}
            <Link href="/admin/tablets" className="font-medium text-[var(--ph-flag-blue)] underline-offset-2 hover:underline">
              Manage tablets
            </Link>
          </p>
          <div className="mt-4">
            <HorizontalBars items={tabletItems} colors={TABLET_COLORS} />
          </div>
        </div>
      </div>

      {!data.electionVotingOpen ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Top 3 results per geo</h3>
          <p className="mt-1 text-xs text-neutral-600">
            By vote count for the active conference
            {data.conferenceName ? (
              <>
                {" "}
                <span className="text-neutral-500">·</span> {data.conferenceName}
              </>
            ) : null}
          </p>
          {!data.activeConfcode ? (
            <p className="mt-4 text-sm text-amber-900">
              No active conference — set one under Settings to load candidates and tallies.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.geoTopThree.map((g) => (
                <GeoTopThreeCard
                  key={g.geoGroupId}
                  geoCode={g.geoCode}
                  geoName={g.geoName}
                  topThree={g.topThree}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
