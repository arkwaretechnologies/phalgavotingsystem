"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginWithQueueAndToken } from "./actions";
import { getBoundTabletId } from "@/lib/tablet/device";
import { useSearchParams } from "next/navigation";
import { useUrlToast } from "@/lib/toast/url-toast";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative mt-2 w-full overflow-hidden rounded-xl bg-linear-to-r from-slate-900 to-slate-800 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition-all duration-200 hover:shadow-xl hover:shadow-slate-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 dark:from-slate-100 dark:to-slate-200 dark:text-slate-900 dark:shadow-slate-900/20 dark:focus-visible:outline-slate-200"
    >
      <span
        className={`inline-flex w-full items-center justify-center gap-2 transition-transform duration-200 ${pending ? "scale-95" : "group-hover:scale-[1.01]"}`}
      >
        {pending ? (
          <>
            <span
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900"
              aria-hidden
            />
            Verifying…
          </>
        ) : (
          "Verify and Vote"
        )}
      </span>
    </button>
  );
}

export function VoteLoginForm() {
  const [tabletId, setTabletId] = useState<number | null>(null);
  const sp = useSearchParams();
  const err = sp.get("error");
  const msg = sp.get("msg");

  useUrlToast({ clearParams: ["error", "msg"] });

  useEffect(() => {
    setTabletId(getBoundTabletId());
  }, []);

  return (
    <form
      action={loginWithQueueAndToken}
      className="vote-login-fade-up vote-login-fade-up-delay-2 space-y-5"
    >
      {/* legacy inline error removed; toast driven by URL params */}
      <input type="hidden" name="tablet_id" value={tabletId ? String(tabletId) : ""} />
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor="queue_number"
        >
          Queue number
        </label>
        <input
          id="queue_number"
          name="queue_number"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200/90 bg-white/80 px-4 py-3 text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-slate-400/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white/30 dark:focus:ring-white/10"
          placeholder="e.g. 12"
          required
        />
      </div>

      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor="token"
        >
          6-digit token
        </label>
        <input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          className="w-full rounded-xl border border-slate-200/90 bg-white/80 px-4 py-3 font-mono text-lg tracking-[0.35em] text-slate-900 shadow-sm transition-all duration-200 placeholder:tracking-normal placeholder:text-slate-400 focus:border-slate-400/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white/30 dark:focus:ring-white/10"
          placeholder="••••••"
          required
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          As shown on your QR or given by Comelec staff.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
