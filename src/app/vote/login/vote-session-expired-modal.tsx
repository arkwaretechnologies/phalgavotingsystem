"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SESSION_EXPIRED_PARAM = "session_expired";

/** Copy requested for the expiry modal (includes intentional wording from product). */
const SESSION_EXPIRED_BODY = "Voter session expires. Sig in to vote again.";

export function VoteSessionExpiredModal() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const v = sp.get(SESSION_EXPIRED_PARAM);
    if (v === "1" || v === "true") setOpen(true);
  }, [sp]);

  const dismiss = useCallback(() => {
    setOpen(false);
    const next = new URLSearchParams(sp.toString());
    next.delete(SESSION_EXPIRED_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, sp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-session-expired-msg"
    >
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-2xl">
        <p id="vote-session-expired-msg" className="text-sm leading-relaxed text-neutral-900">
          {SESSION_EXPIRED_BODY}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-[var(--ph-flag-blue)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ph-flag-blue)]"
        >
          OK
        </button>
      </div>
    </div>
  );
}
