"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { setVotingSessionCookie } from "@/lib/voting/session-cookie";

export async function loginWithQueueAndToken(formData: FormData) {
  const queueNumberRaw = String(formData.get("queue_number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  const queueNumber = Number(queueNumberRaw);
  if (!Number.isFinite(queueNumber) || queueNumber <= 0) {
    throw new Error("Invalid queue number");
  }
  if (!/^\d{6}$/.test(token)) {
    throw new Error("Token must be 6 digits");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("claim_session", {
    p_queue_number: queueNumber,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Unable to claim session");

  await setVotingSessionCookie(String(data));
  redirect("/vote");
}

