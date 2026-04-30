"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { DotLottie } from "@lottiefiles/dotlottie-web";
import { verifyFinalTallyForCanvass } from "./final-tally-actions";

const UNLOCK_LOTTIE_SRC =
  "https://lottie.host/64524799-06de-497b-a8b5-824771be4c4f/i4ZNkIQazS.lottie";

/** Minimum time the Lottie phase is shown so users actually see the animation. */
const UNLOCK_MIN_DURATION_MS = 2200;
/** Hard cap on the Lottie phase in case the asset/WASM never finishes loading. */
const UNLOCK_MAX_DURATION_MS = 8000;
/** Fake progress duration after unlock Lottie completes (ms). */
const CALCULATING_DURATION_MS = 2800;

type OverlayPhase = "none" | "calculating" | "unlock_lottie";

type Props = {
  locked: boolean;
  /** Super admins see Unlock; others see copy only. */
  showUnlock: boolean;
  /** Prefill username for the signed-in super admin. */
  adminUsername: string;
  electionStatusLabel: string;
  /** Active canvass tab so we restore it after the unlock flow finishes. */
  returnTab?: "results" | "ballots" | "canvass";
  children: React.ReactNode;
};

export function CanvassUnlockPreview({
  locked,
  showUnlock,
  adminUsername,
  electionStatusLabel,
  returnTab = "canvass",
  children,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase>("none");
  const [calcProgress, setCalcProgress] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const unlockStartRef = useRef<number>(0);
  const unlockCompleteRef = useRef(false);
  const dotLottieRef = useRef<DotLottie | null>(null);
  const navigateOnceRef = useRef(false);

  function handleVerifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(() => {
      void (async () => {
        const res = await verifyFinalTallyForCanvass(null, fd);
        if (res && "error" in res) {
          setFormError(res.error);
          return;
        }
        if (res && "ok" in res && res.ok) {
          setModalOpen(false);
          unlockCompleteRef.current = false;
          setCalcProgress(0);
          navigateOnceRef.current = false;
          setOverlayPhase("calculating");
        }
      })();
    });
  }

  const finishOverlay = useCallback(() => {
    if (navigateOnceRef.current) return;
    navigateOnceRef.current = true;
    const msg = encodeURIComponent("Election closed. Canvass report unlocked.");
    router.replace(
      `/admin/canvass?tab=${returnTab}&toast=success&message=${msg}`,
    );
    // Dismiss the overlay so the unblurred children render. The parent server component
    // has already re-rendered with `locked: false` (the server action set voting_status
    // to closed), so the iframe is up to date.
    window.setTimeout(() => {
      setOverlayPhase("none");
      // Bumping the key forces the children wrapper to remount so the slide-up
      // animation runs every time the unlock flow completes.
      setRevealKey((k) => k + 1);
    }, 250);
  }, [router, returnTab]);

  const finishUnlockLottie = useCallback(() => {
    if (unlockCompleteRef.current) return;
    const elapsed = performance.now() - unlockStartRef.current;
    const wait = Math.max(0, UNLOCK_MIN_DURATION_MS - elapsed);
    if (wait > 0) {
      window.setTimeout(() => {
        if (unlockCompleteRef.current) return;
        unlockCompleteRef.current = true;
        finishOverlay();
      }, wait);
      return;
    }
    unlockCompleteRef.current = true;
    finishOverlay();
  }, [finishOverlay]);

  useEffect(() => {
    if (overlayPhase !== "unlock_lottie") return;
    unlockStartRef.current = performance.now();
    const hardFallback = window.setTimeout(() => {
      unlockCompleteRef.current = true;
      finishOverlay();
    }, UNLOCK_MAX_DURATION_MS);
    return () => window.clearTimeout(hardFallback);
  }, [overlayPhase, finishOverlay]);

  const handleLottieRef = useCallback(
    (inst: DotLottie | null) => {
      const prev = dotLottieRef.current;
      if (prev && prev !== inst) {
        prev.removeEventListener("complete", finishUnlockLottie);
      }
      dotLottieRef.current = inst;
      if (inst) {
        inst.addEventListener("complete", finishUnlockLottie);
      }
    },
    [finishUnlockLottie],
  );

  useEffect(() => {
    if (overlayPhase !== "calculating") return;

    const start = performance.now();
    let frame = 0;
    let advanced = false;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / CALCULATING_DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setCalcProgress(Math.min(100, Math.round(eased * 100)));

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!advanced) {
        advanced = true;
        // Brief pause at 100% so the bar visibly settles before the Lottie celebration plays.
        window.setTimeout(() => setOverlayPhase("unlock_lottie"), 200);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [overlayPhase]);

  const showPostVerifyOverlay = overlayPhase === "calculating" || overlayPhase === "unlock_lottie";

  // Once the unlock flow starts, the parent Server Component may re-render with `locked: false`
  // (because the server action sets the cookie + voting_status). Keep the lock UI visible while
  // our overlay is animating so the transition isn't skipped.
  const showLockUi = locked || showPostVerifyOverlay;

  if (!showLockUi) {
    return revealKey > 0 ? (
      <div key={revealKey} className="canvass-reveal-up">
        {children}
      </div>
    ) : (
      <>{children}</>
    );
  }

  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none blur-md"
        aria-hidden="true"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-b-2xl bg-white/55 px-6 py-10 backdrop-blur-[2px]">
        <p className="max-w-md text-center text-sm text-neutral-800">
          Results are hidden until the election is closed or a super admin unlocks the canvass
          report.
        </p>
        <p className="text-xs text-neutral-600">
          Voting status: <span className="font-mono">{electionStatusLabel}</span>
        </p>
        {showUnlock && !showPostVerifyOverlay ? (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setModalOpen(true);
            }}
            className="pointer-events-auto rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            Initiate Final Tally
          </button>
        ) : null}
        {!showUnlock && !showPostVerifyOverlay ? (
          <p className="pointer-events-auto max-w-sm text-center text-xs text-neutral-600">
            Ask a super admin to unlock. You can still use other admin areas.
          </p>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="canvass-unlock-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="canvass-unlock-title" className="text-base font-semibold text-neutral-900">
              Confirm closing the election
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Enter the same username and password you use to sign in to the admin panel. This will
              set voting status to <span className="font-mono">closed</span> and unlock the canvass
              preview and PDF download.
            </p>
            <form onSubmit={handleVerifySubmit} className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Username</span>
                <input
                  name="username"
                  type="text"
                  autoComplete="username"
                  defaultValue={adminUsername}
                  required
                  className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              {formError ? (
                <p className="text-sm text-red-700" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {isPending ? "Verifying…" : "Close election & unlock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showPostVerifyOverlay ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-white/92 backdrop-blur-sm px-6"
          role="status"
          aria-live="polite"
          aria-busy={true}
        >
          {overlayPhase === "calculating" ? (
            <>
              <div className="text-center">
                <p className="text-base font-semibold text-neutral-900">Calculating results…</p>
                <p className="mt-2 max-w-sm text-sm text-neutral-600">
                  Aggregating ballots and building final tallies for the canvass report.
                </p>
              </div>
              <div className="w-full max-w-sm">
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-neutral-200/90"
                  role="progressbar"
                  aria-valuenow={calcProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neutral-800 to-black transition-[width] duration-100 ease-out"
                    style={{ width: `${calcProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs tabular-nums text-neutral-500">{calcProgress}%</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-800">Unlocking canvass…</p>
              <div className="h-64 w-64">
                <DotLottieReact
                  src={UNLOCK_LOTTIE_SRC}
                  autoplay
                  loop={false}
                  dotLottieRefCallback={handleLottieRef}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
