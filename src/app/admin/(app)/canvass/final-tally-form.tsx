"use client";

import { useActionState } from "react";
import { requestFinalTally } from "./final-tally-actions";
import { SubmitButton } from "@/app/vote/submit-button";

export function FinalTallyForm() {
  const [state, action] = useActionState(requestFinalTally, null);

  return (
    <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="block flex-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Super admin password
        </span>
        <input
          name="password"
          type="password"
          className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
          placeholder="Enter password to unlock"
          required
        />
      </label>
      <SubmitButton
        pendingLabel="Checking…"
        className="h-10 rounded-md bg-black px-4 text-sm text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        Final Tally
      </SubmitButton>
      {state?.error ? (
        <p className="text-sm text-red-700 sm:basis-full" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

