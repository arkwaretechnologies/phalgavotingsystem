"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/session";
import { toPublicMessage } from "@/lib/errors/public-message";

const QUEUEING_PATH = "/admin/queueing";

function buildRedirect(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${QUEUEING_PATH}?${qs}` : QUEUEING_PATH;
}

async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function skipCurrentQueue(_formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createSupabaseServiceRoleClient();

  const { data: current, error: selErr } = await supabase
    .from("voting_sessions")
    .select("id, queue_number")
    .eq("status", "queued")
    .is("skipped_at", null)
    .order("queue_number", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    console.error("skipCurrentQueue load failed", selErr);
    const { message } = toPublicMessage(selErr, "Unable to load the current queue.");
    redirect(buildRedirect({ toast: "error", message }));
  }

  if (!current) {
    redirect(buildRedirect({ toast: "info", message: "No queued voter to skip." }));
  }

  const { error: upErr } = await supabase
    .from("voting_sessions")
    .update({ skipped_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("status", "queued")
    .is("skipped_at", null);

  if (upErr) {
    console.error("skipCurrentQueue update failed", upErr);
    const { message } = toPublicMessage(upErr, "Unable to skip the current queue.");
    redirect(buildRedirect({ toast: "error", message }));
  }

  revalidatePath(QUEUEING_PATH);
  redirect(
    buildRedirect({
      toast: "success",
      message: `Skipped queue #${current.queue_number}. Calling the next number.`,
    }),
  );
}

export async function recallSkippedQueue(formData: FormData): Promise<void> {
  await requireAdmin();
  const sessionId = String(formData.get("session_id") ?? "").trim();
  if (!sessionId) {
    redirect(buildRedirect({ toast: "error", message: "Missing session id." }));
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: row, error: selErr } = await supabase
    .from("voting_sessions")
    .select("id, queue_number, status, skipped_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (selErr) {
    console.error("recallSkippedQueue load failed", selErr);
    const { message } = toPublicMessage(selErr, "Unable to load that queue entry.");
    redirect(buildRedirect({ toast: "error", message }));
  }

  if (!row) {
    redirect(buildRedirect({ toast: "error", message: "Queue entry not found." }));
  }

  if (row.status !== "queued") {
    redirect(
      buildRedirect({
        toast: "error",
        message: `Cannot re-call: session status is "${String(row.status)}".`,
      }),
    );
  }

  if (!row.skipped_at) {
    redirect(buildRedirect({ toast: "info", message: "That queue entry isn’t skipped." }));
  }

  const { error: upErr } = await supabase
    .from("voting_sessions")
    .update({ skipped_at: null })
    .eq("id", row.id)
    .eq("status", "queued");

  if (upErr) {
    console.error("recallSkippedQueue update failed", upErr);
    const { message } = toPublicMessage(upErr, "Unable to re-call the skipped queue.");
    redirect(buildRedirect({ toast: "error", message }));
  }

  revalidatePath(QUEUEING_PATH);
  redirect(
    buildRedirect({
      toast: "success",
      message: `Re-called queue #${row.queue_number}.`,
    }),
  );
}
