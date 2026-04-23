"use client";

import { useEffect } from "react";

const SUBMITTING_KEY = "phalga_vote_submitting";

/** Set from the confirm form `onSubmit` before the server action runs. */
export function markVoteBallotSubmitting() {
  try {
    sessionStorage.setItem(SUBMITTING_KEY, "1");
  } catch {
    /* no-op */
  }
}

/** Call when ballot submission fails so leaving the page can abandon the session again. */
export function clearVoteBallotSubmittingFlag() {
  try {
    sessionStorage.removeItem(SUBMITTING_KEY);
  } catch {
    /* no-op */
  }
}

/**
 * Warn before leaving / closing, and revert session to queued if the voter leaves without
 * submitting. Skips abandon while a ballot submit is in flight (see {@link markVoteBallotSubmitting}).
 */
export function useVoteLeaveGuard() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      try {
        if (sessionStorage.getItem(SUBMITTING_KEY) === "1") return;
      } catch {
        /* sessionStorage unavailable */
      }
      void fetch("/api/vote/abandon-session", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}
