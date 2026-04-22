"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/session";

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
  if (vErr) throw new Error(vErr.message);

  // Create or reuse session (schema has unique(voter_id))
  const { data: existing, error: exErr } = await supabase
    .from("voting_sessions")
    .select("id, queue_number, status")
    .eq("voter_id", voterId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

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
    if (insErr) throw new Error(insErr.message);
    sessionId = inserted.id;
    queueNumber = inserted.queue_number;
  } else {
    if (existing.status === "queued" || existing.status === "voting") {
      throw new Error("Voter already has an active session.");
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
      })
      .eq("id", existing.id)
      .select("id, queue_number")
      .single();
    if (upErr) throw new Error(upErr.message);
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
  if (bErr) throw new Error(bErr.message);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("checked_in", "1");
  params.set("voter_id", voterId);
  params.set("queue", String(queueNumber));
  params.set("token", token);

  redirect(`/admin/check-in?${params.toString()}`);
}

