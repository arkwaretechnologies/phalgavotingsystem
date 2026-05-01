"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearVoteBallotSubmittingFlag } from "@/app/vote/use-vote-leave-guard";
import { useRouter, useSearchParams } from "next/navigation";

function fireCelebrationConfetti() {
  void import("canvas-confetti").then((mod) => {
    const confetti = mod.default;
    const burst = (particleRatio: number, opts: confetti.Options) => {
      void confetti({
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
        spread: 70,
        origin: { y: 0.65 },
      });
    };
    burst(0.35, { scalar: 1 });
    burst(0.25, { scalar: 1.05, ticks: 100 });
    burst(0.3, { scalar: 0.95, ticks: 90 });
    burst(0.3, {
      particleCount: 45,
      spread: 90,
      startVelocity: 35,
      angle: 60,
      origin: { x: 0, y: 0.65 },
    });
    burst(0.3, {
      particleCount: 45,
      spread: 90,
      startVelocity: 35,
      angle: 120,
      origin: { x: 1, y: 0.65 },
    });
  });
}

export function VoteThanksClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const isPaired = sp.get("paired") === "1";
  const firedRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    clearVoteBallotSubmittingFlag();
    if (firedRef.current) return;
    firedRef.current = true;
    fireCelebrationConfetti();
  }, []);

  useEffect(() => {
    if (!isPaired) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          window.clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPaired]);

  useEffect(() => {
    if (!isPaired) return;
    if (secondsLeft !== 0) return;
    router.replace("/vote/login");
  }, [isPaired, secondsLeft, router]);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16 text-center sm:px-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Thank you for casting your votes
        </h1>
        <p className="text-base leading-relaxed text-white/85">
          Your ballot has been recorded successfully.
        </p>
        <p className="text-sm text-white/70">
          {isPaired
            ? "Please return the tablet to the designated area."
            : "You can leave this page open or close it when you are done. No further action is required."}
        </p>
      </div>

      {isPaired ? (
        <p className="text-sm font-medium text-white/75" aria-live="polite">
          Returning to voter sign-in in{" "}
          <span className="tabular-nums font-semibold text-white">{secondsLeft}</span>{" "}
          {secondsLeft === 1 ? "second" : "seconds"}…
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/vote/login"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          {isPaired ? "Go to voter sign-in now" : "Queue login (optional)"}
        </Link>
      </div>

      <p className="text-xs text-white/55">
        Keep your queue stub until staff confirms your voting transaction is complete.
      </p>
    </main>
  );
}
