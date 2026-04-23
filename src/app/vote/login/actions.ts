"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { setVotingSessionCookie } from "@/lib/voting/session-cookie";

export async function loginWithQueueAndToken(formData: FormData) {
  const queueNumberRaw = String(formData.get("queue_number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = tabletIdRaw ? Number(tabletIdRaw) : null;

  const queueNumber = Number(queueNumberRaw);
  if (!Number.isFinite(queueNumber) || queueNumber <= 0) {
    throw new Error("Invalid queue number");
  }
  if (!/^\d{6}$/.test(token)) {
    throw new Error("Token must be 6 digits");
  }
  if (tabletId !== null && (!Number.isFinite(tabletId) || tabletId <= 0)) {
    throw new Error("Invalid tablet id");
  }

  const supabase = createSupabaseServiceRoleClient();
  // Prefer RPC if installed; fall back to direct update if not present.
  let sessionId: string | null = null;
  const votedVia = tabletId ? "tablet" : "phone";
  const { data, error } = await supabase.rpc("claim_session", {
    p_queue_number: queueNumber,
    p_token: token,
    p_voted_via: votedVia,
  });
  if (!error && data) {
    sessionId = String(data);
  } else if (error?.message?.includes("schema cache") || error?.message?.includes("Could not find the function")) {
    // Fallback for DBs that haven't applied the RPC migration yet.
    const { data: session, error: sErr } = await supabase
      .from("voting_sessions")
      .select("id, status")
      .eq("queue_number", queueNumber)
      .eq("token", token)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session?.id) throw new Error("Invalid queue/token");
    if (session.status !== "queued") throw new Error("Session is not queued");

    const { error: upErr } = await supabase
      .from("voting_sessions")
      .update({
        status: "voting",
        voted_via: votedVia,
        session_start: new Date().toISOString(),
        tablet_id: tabletId,
      })
      .eq("id", session.id);
    if (upErr) throw new Error(upErr.message);

    if (tabletId) {
      const { error: tErr } = await supabase
        .from("tablets")
        .update({
          status: "in_use",
          current_session: session.id,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", tabletId);
      if (tErr) throw new Error(tErr.message);
    }

    sessionId = String(session.id);
  } else if (error) {
    throw new Error(error.message);
  }

  if (!sessionId) throw new Error("Unable to claim session");

  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("active_confcode")
    .eq("id", 1)
    .maybeSingle();

  const rawConf = (settingsRow as { active_confcode?: string | null } | null)?.active_confcode;
  const confcode =
    rawConf != null && String(rawConf).trim() !== "" ? String(rawConf).trim() : null;

  const { error: ballotErr } = await supabase
    .from("ballots")
    .update({ confcode })
    .eq("session_id", sessionId);

  if (ballotErr) throw new Error(ballotErr.message);

  await setVotingSessionCookie(sessionId);
  redirect("/vote");
}

