"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearVoteBallotSubmittingFlag } from "@/app/vote/use-vote-leave-guard";

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
  const [secondsLeft, setSecondsLeft] = useState(10);
  const firedRef = useRef(false);

  useEffect(() => {
    clearVoteBallotSubmittingFlag();
    if (firedRef.current) return;
    firedRef.current = true;
    fireCelebrationConfetti();
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    router.replace("/vote/login");
  }, [secondsLeft, router]);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16 text-center sm:px-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Thank you for casting your votes
        </h1>
        <p className="text-base leading-relaxed text-neutral-700">
          Please proceed to Comelec personnel to complete your voting transaction.
        </p>
        <p className="text-sm text-neutral-600">
          If you used a voting tablet, you may leave it at the designated area—staff will ready it for
          the next voter.
        </p>
      </div>

      <p className="text-sm font-medium text-neutral-600" aria-live="polite">
        Returning to queue login in{" "}
        <span className="tabular-nums font-semibold text-white">{secondsLeft}</span>{" "}
        {secondsLeft === 1 ? "second" : "seconds"}…
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/vote/login"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          Go to queue login now
        </Link>
      </div>

      <p className="text-xs text-neutral-500">
        Your ballot is saved. The voting station tablet (if any) is released for the next voter when
        your ballot was submitted.
      </p>
    </main>
  );
}
