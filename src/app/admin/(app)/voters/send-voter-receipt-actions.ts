"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { adminRedirectWithToast } from "@/lib/admin/admin-toast-redirect";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendVoterReceiptEmailForBallot } from "@/lib/email/vote-receipt";

export async function sendVoterReceipt(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!(await sessionHasAdminPageAccess(session, "voters"))) {
    redirect("/admin?error=" + encodeURIComponent("You do not have access to that page."));
  }

  const voterId = String(formData.get("voter_id") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "").trim() || "/admin/voters";

  if (!voterId) {
    adminRedirectWithToast(returnTo, "error", "Missing voter id.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: voter } = await supabase
    .from("voters")
    .select("email, phone")
    .eq("id", voterId)
    .maybeSingle();

  const email = String(voter?.email ?? "").trim();
  const phone = String(voter?.phone ?? "").trim();

  if (!email && !phone) {
    adminRedirectWithToast(returnTo, "error", "Email and phone are required.");
  }

  const { data: ballot } = await supabase
    .from("ballots")
    .select("id")
    .eq("voter_id", voterId)
    .eq("is_submitted", true)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ballot?.id) {
    adminRedirectWithToast(returnTo, "error", "No submitted ballot found for this voter.");
  }

  const result = await sendVoterReceiptEmailForBallot(String(ballot.id));

  revalidatePath(returnTo);
  revalidatePath("/admin/voters");

  if (result.ok) {
    adminRedirectWithToast(returnTo, "success", "Voter receipt email sent.");
  }

  const message =
    result.message ??
    (result.reason === "missing_voter_email"
      ? "Voter has no email on file."
      : result.reason === "no_ballot"
        ? "Ballot not found or not submitted."
        : "Unable to send voter receipt. Check server logs.");

  adminRedirectWithToast(returnTo, "error", message);
}
