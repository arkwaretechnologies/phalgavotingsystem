"use client";

import { useFormStatus } from "react-dom";
import { resendVoteReceipt } from "./resend-receipt-actions";

function SubmitLabel() {
  const { pending } = useFormStatus();
  return pending ? "Sending…" : "Resend vote receipt email";
}

export function ResendVoteReceiptButton({
  ballotId,
  returnTo,
  disabled,
}: {
  ballotId: string;
  returnTo: string;
  disabled?: boolean;
}) {
  return (
    <form action={resendVoteReceipt}>
      <input type="hidden" name="ballot_id" value={ballotId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SubmitLabel />
      </button>
    </form>
  );
}
