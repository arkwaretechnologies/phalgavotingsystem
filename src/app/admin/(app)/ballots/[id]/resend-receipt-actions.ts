"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { sendVoterReceiptEmailForBallot } from "@/lib/email/vote-receipt";

export async function resendVoteReceipt(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!(await sessionHasAdminPageAccess(session, "canvass"))) {
    redirect("/admin?error=" + encodeURIComponent("You do not have access to that page."));
  }

  const ballotId = String(formData.get("ballot_id") ?? "").trim();
  if (!ballotId) {
    redirect("/admin/canvass?tab=ballots&toast=error&message=" + encodeURIComponent("Missing ballot id."));
  }

  const result = await sendVoterReceiptEmailForBallot(ballotId);
  const returnTo = String(formData.get("return_to") ?? "").trim() || `/admin/ballots/${ballotId}`;

  revalidatePath(returnTo);
  revalidatePath("/admin/canvass");

  if (result.ok) {
    redirect(
      `${returnTo}?toast=success&message=${encodeURIComponent("Vote receipt email sent.")}`,
    );
  }

  const message =
    result.message ??
    (result.reason === "missing_voter_email"
      ? "Voter has no email on file."
      : result.reason === "no_ballot"
        ? "Ballot not found or not submitted."
        : "Unable to send vote receipt. Check server logs.");

  redirect(`${returnTo}?toast=error&message=${encodeURIComponent(message)}`);
}
