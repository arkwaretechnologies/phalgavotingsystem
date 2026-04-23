"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { setVotingSessionCookie } from "@/lib/voting/session-cookie";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function loginWithQueueAndToken(formData: FormData) {
  const queueNumberRaw = String(formData.get("queue_number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = tabletIdRaw ? Number(tabletIdRaw) : null;

  const queueNumber = Number(queueNumberRaw);
  if (!Number.isFinite(queueNumber) || queueNumber <= 0) {
    redirect("/vote/login?error=invalid");
  }
  if (!/^\d{6}$/.test(token)) {
    redirect("/vote/login?error=invalid");
  }
  if (tabletId !== null && (!Number.isFinite(tabletId) || tabletId <= 0)) {
    redirect("/vote/login?error=invalid");
  }

  const supabase = createSupabaseServiceRoleClient();
  const votedVia = tabletId ? "tablet" : "phone";

  try {
    // Prefer RPC if installed; fall back to direct update if not present.
    let sessionId: string | null = null;
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
      if (sErr) throw sErr;
      if (!session?.id) redirect("/vote/login?error=invalid");
      if (session.status !== "queued") redirect("/vote/login?error=notqueued");

      const { error: upErr } = await supabase
        .from("voting_sessions")
        .update({
          status: "voting",
          voted_via: votedVia,
          session_start: new Date().toISOString(),
          tablet_id: tabletId,
        })
        .eq("id", session.id);
      if (upErr) throw upErr;

      if (tabletId) {
        const { error: tErr } = await supabase
          .from("tablets")
          .update({
            status: "in_use",
            current_session: session.id,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", tabletId);
        if (tErr) throw tErr;
      }

      sessionId = String(session.id);
    } else if (error) {
      // Normalize common cases.
      const msg = String(error.message ?? "").toLowerCase();
      if (msg.includes("invalid") || msg.includes("not found") || msg.includes("queue") || msg.includes("token")) {
        redirect("/vote/login?error=invalid");
      }
      if (msg.includes("already") || msg.includes("used") || msg.includes("voted")) {
        redirect("/vote/login?error=used");
      }
      throw error;
    }

    if (!sessionId) redirect("/vote/login?error=invalid");

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

    if (ballotErr) throw ballotErr;

    await setVotingSessionCookie(sessionId);
    redirect("/vote");
  } catch (e) {
    unstable_rethrow(e);
    // eslint-disable-next-line no-console
    console.error("vote login failed", e);
    const { message } = toPublicMessage(e, "Unable to sign in right now. Please try again.");
    // Preserve a safe, non-sensitive error path for the UI.
    redirect(`/vote/login?error=unknown&msg=${encodeURIComponent(message)}`);
  }
}

