"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/session";
import { toPublicMessage } from "@/lib/errors/public-message";

function genToken6() {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

export async function checkInVoter(formData: FormData) {
  const voterId = String(formData.get("voter_id") ?? "").trim();
  const q = String(formData.get("q") ?? "").trim();

  if (!voterId) throw new Error("Missing voter id");

  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const supabase = createSupabaseServiceRoleClient();

  const token = genToken6();
  const qr_payload = JSON.stringify({ token, voter_id: voterId });

  // Mark verified
  const { error: vErr } = await supabase
    .from("voters")
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: admin.admin_user_id,
    })
    .eq("id", voterId);
  if (vErr) {
    // eslint-disable-next-line no-console
    console.error("check-in verify voter failed", vErr);
    const { message } = toPublicMessage(vErr, "Unable to verify voter. Please try again.");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("error", message);
    redirect(`/admin/check-in?${params.toString()}`);
  }

  // Create or reuse session (schema has unique(voter_id))
  const { data: existing, error: exErr } = await supabase
    .from("voting_sessions")
    .select("id, queue_number, status, session_end, created_at")
    .eq("voter_id", voterId)
    .maybeSingle();
  if (exErr) {
    // eslint-disable-next-line no-console
    console.error("check-in load existing session failed", exErr);
    const { message } = toPublicMessage(exErr, "Unable to check session state. Please try again.");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("error", message);
    redirect(`/admin/check-in?${params.toString()}`);
  }

  let sessionId: string;
  let queueNumber: number;

  if (!existing) {
    const { data: inserted, error: insErr } = await supabase
      .from("voting_sessions")
      .insert({
        voter_id: voterId,
        token,
        qr_payload,
        status: "queued",
        tablet_id: null,
        voted_via: null,
        session_start: null,
        session_end: null,
      })
      .select("id, queue_number")
      .single();
    if (insErr) {
      // eslint-disable-next-line no-console
      console.error("check-in insert session failed", insErr);
      const { message } = toPublicMessage(insErr, "Unable to create voting session. Please try again.");
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("error", message);
      redirect(`/admin/check-in?${params.toString()}`);
    }
    sessionId = inserted.id;
    queueNumber = inserted.queue_number;
  } else {
    if (existing.status === "queued" || existing.status === "voting") {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("error", "Voter already has an active session.");
      redirect(`/admin/check-in?${params.toString()}`);
    }
    if (existing.status === "voted") {
      const whenRaw = (existing as { session_end?: string | null; created_at?: string | null }).session_end
        ?? (existing as { created_at?: string | null }).created_at
        ?? null;
      const whenText = whenRaw ? new Date(whenRaw).toLocaleString() : "unknown time";
      const qn = (existing as { queue_number?: number | null }).queue_number;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set(
        "error",
        `Voter already voted (Queue #${qn ?? "—"}) at ${whenText} and cannot be checked-in again.`,
      );
      redirect(`/admin/check-in?${params.toString()}`);
    }

    const { data: updated, error: upErr } = await supabase
      .from("voting_sessions")
      .update({
        token,
        qr_payload,
        status: "queued",
        tablet_id: null,
        voted_via: null,
        session_start: null,
        session_end: null,
        skipped_at: null,
      })
      .eq("id", existing.id)
      .select("id, queue_number")
      .single();
    if (upErr) {
      // eslint-disable-next-line no-console
      console.error("check-in update session failed", upErr);
      const { message } = toPublicMessage(upErr, "Unable to re-queue voter. Please try again.");
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("error", message);
      redirect(`/admin/check-in?${params.toString()}`);
    }
    sessionId = updated.id;
    queueNumber = updated.queue_number;
  }

  // Ensure ballot exists and points to this session
  const { error: bErr } = await supabase
    .from("ballots")
    .upsert(
      {
        voter_id: voterId,
        session_id: sessionId,
        is_submitted: false,
        submitted_at: null,
      },
      { onConflict: "voter_id" }
    );
  if (bErr) {
    // eslint-disable-next-line no-console
    console.error("check-in upsert ballot failed", bErr);
    const { message } = toPublicMessage(bErr, "Unable to prepare ballot. Please try again.");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("error", message);
    redirect(`/admin/check-in?${params.toString()}`);
  }

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("checked_in", "1");
  params.set("voter_id", voterId);
  params.set("queue", String(queueNumber));
  params.set("token", token);

  redirect(`/admin/check-in?${params.toString()}`);
}

