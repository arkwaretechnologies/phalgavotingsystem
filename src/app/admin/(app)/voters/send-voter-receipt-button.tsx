"use client";

import { useFormStatus } from "react-dom";
import { sendVoterReceipt } from "./send-voter-receipt-actions";

function SubmitLabel() {
  const { pending } = useFormStatus();
  return pending ? "Sending…" : "Send Voter Receipt";
}

export function SendVoterReceiptButton({
  voterId,
  returnTo,
}: {
  voterId: string;
  returnTo: string;
}) {
  return (
    <form action={sendVoterReceipt} className="inline">
      <input type="hidden" name="voter_id" value={voterId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-xs font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SubmitLabel />
      </button>
    </form>
  );
}
