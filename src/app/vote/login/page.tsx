import Link from "next/link";
import { redirect } from "next/navigation";
import { isVoteLoginBypassed } from "@/lib/voting/dev-bypass";
import { VoteLoginForm } from "./vote-login-form";
import { Suspense } from "react";

export default function VoteLoginPage() {
  if (isVoteLoginBypassed()) redirect("/vote");

  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden font-sans">
      {/* Ambient background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
      >
        <div
          className="vote-login-shimmer absolute inset-0 bg-linear-to-br from-slate-100 via-indigo-50/80 to-cyan-50/90 dark:from-slate-950 dark:via-indigo-950/40 dark:to-slate-900/90"
        />
        <div
          className="vote-login-blob absolute -left-[20%] -top-[30%] h-[60vmin] w-[60vmin] rounded-full bg-indigo-400/25 blur-3xl dark:bg-indigo-500/15"
        />
        <div
          className="vote-login-blob absolute -right-[15%] bottom-[-20%] h-[55vmin] w-[55vmin] rounded-full bg-cyan-400/20 blur-3xl [animation-delay:-6s] dark:bg-cyan-500/10"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.2),transparent)]" />
      </div>

      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
        <div className="vote-login-fade-up mb-6 flex items-center justify-between gap-4 text-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <span aria-hidden className="text-lg leading-none">←</span>
            <span>Home</span>
          </Link>
          <span className="rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Voter
          </span>
        </div>

        <div
          className="vote-login-fade-up vote-login-fade-up-delay-1 relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-2xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 dark:shadow-black/40 sm:p-10"
        >
          <div
            className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-linear-to-br from-indigo-400/20 to-transparent blur-2xl dark:from-indigo-400/10"
            aria-hidden
          />
          <div
            className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-linear-to-tr from-cyan-400/15 to-transparent blur-2xl dark:from-cyan-400/8"
            aria-hidden
          />

          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Sign in to vote
            </h1>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Enter the queue number you were assigned and the six-digit code from
              your QR or from Comelec personnel, then continue to the ballot.
            </p>

            <div className="mt-8">
              <Suspense fallback={<div className="text-sm text-slate-600">Loading…</div>}>
                <VoteLoginForm />
              </Suspense>
            </div>
          </div>
        </div>

        <p className="vote-login-fade-up vote-login-fade-up-delay-3 mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
          PhALGA Automated Online Voting System
        </p>
      </div>
    </main>
  );
}
