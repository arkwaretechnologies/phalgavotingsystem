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
      className="ph-glossy-black group relative mt-2 w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#050203] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
    >
      <span
        className={`inline-flex w-full items-center justify-center gap-2 transition-transform duration-200 ${pending ? "scale-95" : "group-hover:scale-[1.01]"}`}
      >
        {pending ? (
          <>
            <span
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
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

  void err;
  void msg;
  useUrlToast({ keys: { message: "msg" }, clearParams: ["error", "msg"], duration: 5000 });

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
        <label className="block text-sm font-medium text-neutral-800" htmlFor="queue_number">
          Queue number
        </label>
        <input
          id="queue_number"
          name="queue_number"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-sm transition-all duration-200 placeholder:text-neutral-400 focus:border-[#050203] focus:outline-none focus:ring-4 focus:ring-[#050203]/10"
          placeholder="e.g. 12"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-neutral-800" htmlFor="token">
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
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-lg tracking-[0.35em] text-neutral-900 shadow-sm transition-all duration-200 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#050203] focus:outline-none focus:ring-4 focus:ring-[#050203]/10"
          placeholder="••••••"
          required
        />
        <p className="text-xs text-neutral-600">
          As shown on your QR or given by Comelec staff.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
