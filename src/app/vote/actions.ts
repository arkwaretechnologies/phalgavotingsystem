"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  clearVotingSessionCookie,
  getVotingSessionIdFromCookie,
} from "@/lib/voting/session-cookie";

export type BallotChoicePayload = {
  geo_group_id: number;
  candidate_ids: string[];
};

export async function confirmBallotSubmission(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const sessionId = await getVotingSessionIdFromCookie();
  if (!sessionId) {
    return {
      error: "Your voting session expired. Sign in again from the queue screen.",
    };
  }

  const raw = String(formData.get("choices") ?? "").trim();
  let choices: BallotChoicePayload[];
  try {
    choices = JSON.parse(raw) as BallotChoicePayload[];
    if (!Array.isArray(choices)) throw new Error("invalid payload");
  } catch {
    return { error: "Invalid ballot data. Go back and try again." };
  }

  const supabase = createSupabaseServiceRoleClient();

  // Migrations differ: `0002` uses `p_session_id`, `0001` uses `p_voting_session_id`.
  // PostgREST matches RPC JSON keys to PostgreSQL parameter names; a mismatch surfaces as
  // "Could not find the function … in the schema cache".
  const attempts: Record<string, unknown>[] = [
    { p_session_id: sessionId, p_choices: choices },
    { p_voting_session_id: sessionId, p_choices: choices },
  ];

  let submitError: string | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const { error } = await supabase.rpc("submit_ballot", attempts[i]);
    if (!error) {
      submitError = null;
      break;
    }
    const msg = error.message ?? "";
    submitError = msg;
    if (
      i === 0 &&
      (msg.includes("Could not find the function") || msg.includes("schema cache"))
    ) {
      continue;
    }
    break;
  }
  if (submitError) {
    return { error: submitError };
  }

  await clearVotingSessionCookie();
  redirect("/vote/thanks");
}
