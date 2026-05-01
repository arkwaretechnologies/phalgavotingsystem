"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TabletRow = { id: number; label: string; status: string | null };

type ActiveVotingRow = { queue_number: number; tablet_id: number | null };

type VotingWindowPayload = {
  start: string | null;
  end: string | null;
  status: "open" | "not_started" | "closed";
  msRemaining: number | null;
};

type Payload = {
  queue_numbers: number[];
  active_voting?: ActiveVotingRow[];
  tablets: TabletRow[];
  now: string;
  votingWindow?: VotingWindowPayload;
  error?: string;
};

const POLL_MS = 2500;
const BANNER_MS = 14000;

function IconEnterFullscreen({ className }: { className?: string }) {
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

function IconExitFullscreen({ className }: { className?: string }) {
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

async function toggleBrowserFullscreen() {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  };
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };

  const active = document.fullscreenElement ?? doc.webkitFullscreenElement;
  try {
    if (active) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }
  } catch {
    /* unsupported or blocked */
  }
}

function speakNowServing(n: number) {
  if (typeof window === "undefined") return;
  const syn = window.speechSynthesis;
  if (!syn) return;

  syn.cancel();
  const u = new SpeechSynthesisUtterance(`Now serving queue number ${n}.`);
  u.rate = 0.92;
  u.pitch = 1;
  u.lang = "en-PH";
  syn.speak(u);
}

function formatTabletLine(t: TabletRow) {
  const name = (t.label ?? "").trim() || `Tablet ${t.id}`;
  return `Tablet ${t.id} (${name})`;
}

function tabletLineForId(tablets: TabletRow[], tabletId: number | null): string | null {
  if (tabletId == null) return null;
  const t = tablets.find((x) => Number(x.id) === Number(tabletId));
  return t ? formatTabletLine(t) : `Tablet ${tabletId}`;
}

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

function VotingSessionCountdownPane({
  votingWindow,
  windowLabel,
  windowValue,
}: {
  votingWindow: VotingWindowPayload | null;
  windowLabel: string;
  windowValue: string;
}) {
  return (
    <div
      className="bg-transparent px-1 py-1 text-center text-white"
      aria-live="polite"
      aria-label={
        votingWindow
          ? `${windowLabel} ${windowValue}${votingWindow.start ? `. Start ${formatManila(votingWindow.start)}` : ""}`
          : "Voting schedule loading"
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{windowLabel}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">{windowValue}</p>
      {votingWindow?.start ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/85">
          Start: {formatManila(votingWindow.start)}
        </p>
      ) : null}
    </div>
  );
}

export default function QueueDisplayClient() {
  const [queueNumbers, setQueueNumbers] = useState<number[]>([]);
  const [activeVoting, setActiveVoting] = useState<ActiveVotingRow[]>([]);
  const [tablets, setTablets] = useState<TabletRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [votingWindow, setVotingWindow] = useState<VotingWindowPayload | null>(null);
  const [votingWindowFetchedAtMs, setVotingWindowFetchedAtMs] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const prevStatusRef = useRef<Record<number, string | null>>({});
  const bannerKeyRef = useRef(0);
  const lastAnnouncedServingRef = useRef<number | null>(null);

  const showBanner = useCallback((text: string) => {
    bannerKeyRef.current += 1;
    const key = bannerKeyRef.current;
    setBanner({ text, key });
    window.setTimeout(() => {
      setBanner((b) => (b?.key === key ? null : b));
    }, BANNER_MS);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/queue-display/state", { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok) {
        setFetchError(json.error ?? "Unable to load queue");
        setConnected(false);
        return;
      }
      setFetchError(null);
      setConnected(true);
      setQueueNumbers(json.queue_numbers ?? []);
      setActiveVoting(json.active_voting ?? []);
      const nextTablets = json.tablets ?? [];
      setTablets(nextTablets);
      if (json.votingWindow) {
        setVotingWindow(json.votingWindow);
        const anchor = new Date(json.now).getTime();
        setVotingWindowFetchedAtMs(Number.isFinite(anchor) ? anchor : Date.now());
      }

      const prev = prevStatusRef.current;
      const becameVacant: TabletRow[] = [];
      for (const t of nextTablets) {
        const was = prev[t.id];
        const isVacant = t.status === "vacant";
        if (isVacant && was !== undefined && was !== null && was !== "vacant") {
          becameVacant.push(t);
        }
      }
      prevStatusRef.current = Object.fromEntries(nextTablets.map((t) => [t.id, t.status]));

      if (becameVacant.length === 1) {
        const t = becameVacant[0];
        showBanner(`${formatTabletLine(t)} is vacant — please proceed.`);
      } else if (becameVacant.length > 1) {
        const parts = becameVacant.map(formatTabletLine);
        showBanner(`${parts.join(" · ")} are vacant — please proceed.`);
      }
    } catch {
      setFetchError("Connection lost");
      setConnected(false);
    }
  }, [showBanner]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      window.clearInterval(id);
      window.speechSynthesis?.cancel();
    };
  }, [poll]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /** Some browsers (notably iOS) need a user gesture before speech plays reliably. */
  useEffect(() => {
    const unlock = () => {
      try {
        window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const sortedQueue = useMemo(
    () => [...queueNumbers].sort((a, b) => a - b),
    [queueNumbers]
  );
  const sortedActiveVoting = useMemo(
    () => [...activeVoting].sort((a, b) => a.queue_number - b.queue_number),
    [activeVoting]
  );
  const nowServing = sortedQueue[0];
  const nextInLine = sortedQueue.slice(1);

  useEffect(() => {
    if (!voiceOn) {
      window.speechSynthesis?.cancel();
      lastAnnouncedServingRef.current = null;
      return;
    }

    if (nowServing === undefined || nowServing === null || Number.isNaN(Number(nowServing))) {
      window.speechSynthesis?.cancel();
      lastAnnouncedServingRef.current = null;
      return;
    }

    if (lastAnnouncedServingRef.current === nowServing) return;
    lastAnnouncedServingRef.current = nowServing;
    speakNowServing(nowServing);
  }, [nowServing, voiceOn]);

  const vacantNow = tablets.filter((t) => t.status === "vacant");

  const liveWindowMsRemaining = useMemo(() => {
    if (!votingWindow) return null;
    const base = votingWindow.msRemaining;
    if (base == null) return null;
    const anchor = votingWindowFetchedAtMs ?? nowTick;
    const elapsed = Math.max(0, nowTick - anchor);
    return Math.max(0, base - elapsed);
  }, [votingWindow, votingWindowFetchedAtMs, nowTick]);

  const windowLabel =
    votingWindow?.status === "open"
      ? "Voting ends in"
      : votingWindow?.status === "not_started"
        ? "Voting starts in"
        : "Voting closed";

  const windowValue =
    votingWindow == null
      ? "—"
      : votingWindow.status === "closed"
        ? "Closed"
        : votingWindow.status === "open" && votingWindow.msRemaining == null
          ? "Open"
          : votingWindow.status === "not_started" && votingWindow.msRemaining == null
            ? "Scheduled"
            : formatHHMMSS(liveWindowMsRemaining);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* ambient */}
      <div
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden
      />

      {banner ? (
        <div
          className="queue-display-banner fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-4"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-4xl rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 px-8 py-5 text-center shadow-2xl shadow-emerald-900/50 backdrop-blur">
            <p className="text-lg font-semibold tracking-tight text-white sm:text-2xl">{banner.text}</p>
            <p className="mt-1 text-sm font-medium text-emerald-100/90">Proceed to the voting station when your number is called</p>
          </div>
        </div>
      ) : null}

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-4 sm:px-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/90">PhALGA</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Voter queue</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {fetchError ? (
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200">{fetchError}</span>
          ) : null}
          <button
            type="button"
            onClick={() => void toggleBrowserFullscreen()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-200 transition-colors hover:bg-white/10"
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          >
            {isFullscreen ? (
              <IconExitFullscreen className="h-5 w-5" />
            ) : (
              <IconEnterFullscreen className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setVoiceOn((v) => {
                const next = !v;
                if (!next) window.speechSynthesis?.cancel();
                else lastAnnouncedServingRef.current = null;
                return next;
              });
            }}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              voiceOn
                ? "border-violet-400/50 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
                : "border-white/15 bg-white/5 text-slate-400 hover:bg-white/10",
            ].join(" ")}
            aria-pressed={voiceOn}
            title="Announce the Now serving number when it changes"
          >
            Voice {voiceOn ? "on" : "off"}
          </button>
          <span
            className={[
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              connected ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-white/15 bg-white/5 text-slate-400",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                connected ? "animate-pulse bg-emerald-400" : "bg-slate-500",
              ].join(" ")}
            />
            {connected ? "Live" : "Connecting…"}
          </span>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-8 pt-6 sm:px-8 lg:px-10">
        {sortedQueue.length === 0 ? (
          <div className="mx-auto mt-5 max-w-md">
            <VotingSessionCountdownPane
              votingWindow={votingWindow}
              windowLabel={windowLabel}
              windowValue={windowValue}
            />
          </div>
        ) : null}

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-8 lg:mt-8 lg:flex-row lg:items-stretch lg:gap-10 xl:gap-14">
          {/* Left: sessions currently on the ballot */}
          {sortedActiveVoting.length > 0 ? (
            <div className="order-2 flex w-full shrink-0 flex-col items-center lg:order-1 lg:w-[min(100%,280px)] lg:items-stretch xl:w-[300px]">
              <aside
                className="flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm sm:p-5"
                aria-label="Actively voting"
              >
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Actively voting</h2>
                <ol className="mt-4 flex max-h-[50vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-220px)] lg:flex-1">
                  {sortedActiveVoting.map((row, i) => {
                    const station = tabletLineForId(tablets, row.tablet_id);
                    return (
                      <li key={`${row.queue_number}-${row.tablet_id ?? "x"}`}>
                        <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/25 text-xs font-bold text-emerald-200">
                              {i + 1}
                            </span>
                            <span className="font-mono text-xl font-semibold tabular-nums text-white">
                              #{row.queue_number}
                            </span>
                          </div>
                          {station ? (
                            <p className="pl-11 text-[11px] font-medium leading-snug text-emerald-100/85">{station}</p>
                          ) : (
                            <p className="pl-11 text-[11px] leading-snug text-zinc-500">Ballot in progress</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </aside>
            </div>
          ) : null}

          {/* Hero: single “now serving” number */}
          <div className="order-1 flex min-h-[280px] flex-1 flex-col items-center justify-center lg:order-2 lg:min-h-0">
            {sortedQueue.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-16 text-center backdrop-blur-sm">
                <p className="text-lg text-slate-300">No queue numbers at the moment</p>
                <p className="mt-2 text-sm text-zinc-400">Check back after voters check in</p>
              </div>
            ) : (
              <div className="flex w-full max-w-xl flex-col items-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300/90">Now serving</p>
                <div
                  className="mt-6 flex aspect-square w-full max-w-[min(100%,420px)] flex-col items-center justify-center rounded-[2rem] border-2 border-indigo-400/35 bg-gradient-to-b from-white/[0.14] to-white/[0.04] shadow-[0_0_60px_-12px_rgba(99,102,241,0.45)] backdrop-blur-sm"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <span className="text-sm font-semibold text-indigo-200/80">Queue #</span>
                  <span className="mt-2 text-7xl font-black tabular-nums tracking-tight text-white sm:text-8xl lg:text-9xl">
                    {nowServing}
                  </span>
                </div>
                {nextInLine.length === 0 ? (
                  <p className="mt-6 text-center text-sm text-slate-400">No one else is waiting in this queue</p>
                ) : null}
              </div>
            )}
          </div>

          {/* Side: voting window + upcoming numbers */}
          {sortedQueue.length > 0 ? (
            <div className="order-3 flex w-full shrink-0 flex-col items-center gap-1 lg:w-[min(100%,280px)] lg:items-stretch xl:w-[300px]">
              <VotingSessionCountdownPane
                votingWindow={votingWindow}
                windowLabel={windowLabel}
                windowValue={windowValue}
              />
              <aside
                className="flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm sm:p-5"
                aria-label="Next in line"
              >
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Next in line</h2>
              {nextInLine.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  You’re the only one in the queue right now.
                </p>
              ) : (
                <ol className="mt-4 flex max-h-[50vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-220px)] lg:flex-1">
                  {nextInLine.map((n, i) => (
                    <li key={n}>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/25 text-xs font-bold text-indigo-200">
                          {i + 1}
                        </span>
                        <span className="font-mono text-xl font-semibold tabular-nums text-white">#{n}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              </aside>
            </div>
          ) : null}
        </div>

        {vacantNow.length > 0 ? (
          <footer className="mt-auto border-t border-white/10 pt-6">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Open stations</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {vacantNow.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100"
                >
                  {formatTabletLine(t)}
                </span>
              ))}
            </div>
          </footer>
        ) : null}
      </main>
    </div>
  );
}
