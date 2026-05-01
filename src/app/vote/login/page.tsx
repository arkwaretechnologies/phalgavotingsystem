import { redirect } from "next/navigation";
import { isVoteLoginBypassed } from "@/lib/voting/dev-bypass";
import { getVotingActiveConference } from "@/lib/voting/vote-catalog";
import { ConferenceBanner } from "../conference-banner";
import { VoteLoginForm } from "./vote-login-form";
import { Suspense } from "react";

export default async function VoteLoginPage() {
  if (isVoteLoginBypassed()) redirect("/vote");

  const { conference, activeConfcode } = await getVotingActiveConference();

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-hidden font-sans">
      {/* Ambient background — Philippine flag wash */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
      >
        <div
          className="vote-login-shimmer absolute inset-0 bg-linear-to-br from-white via-[#dde7ff]/70 to-[#fde2e6]/80"
        />
        <div
          className="vote-login-blob absolute -left-[20%] -top-[30%] h-[60vmin] w-[60vmin] rounded-full bg-[var(--ph-flag-blue)]/20 blur-3xl"
        />
        <div
          className="vote-login-blob absolute -right-[15%] bottom-[-20%] h-[55vmin] w-[55vmin] rounded-full bg-[var(--ph-flag-red)]/18 blur-3xl [animation-delay:-6s]"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,56,168,0.14),transparent)]"
        />
      </div>

      <div aria-hidden className="ph-flag-strip-top" />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="vote-login-fade-up mb-6 flex items-center justify-end gap-4 text-sm">
          <span className="ph-brand-highlight rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
            Voter
          </span>
        </div>

        <div className="vote-login-fade-up">
          <ConferenceBanner conference={conference} activeConfcode={activeConfcode} />
        </div>

        <div
          className="vote-login-fade-up vote-login-fade-up-delay-1 relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl shadow-[var(--ph-flag-blue-deep)]/10 backdrop-blur-xl sm:p-10"
        >
          <div
            className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-linear-to-br from-[var(--ph-flag-blue)]/25 to-transparent blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-linear-to-tr from-[var(--ph-flag-red)]/20 to-transparent blur-2xl"
            aria-hidden
          />

          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Sign in to vote
            </h1>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-neutral-600">
              Enter the queue number you were assigned and the six-digit code from
              your QR or from Comelec personnel, then continue to the ballot.
            </p>

            <div className="mt-8">
              <Suspense fallback={<div className="text-sm text-neutral-600">Loading…</div>}>
                <VoteLoginForm />
              </Suspense>
            </div>
          </div>
        </div>

        <p className="vote-login-fade-up vote-login-fade-up-delay-3 mt-6 text-center text-xs text-neutral-600">
          PhALGA Automated Online Voting System
        </p>
      </div>

      <div aria-hidden className="ph-flag-strip-bottom" />
    </main>
  );
}
