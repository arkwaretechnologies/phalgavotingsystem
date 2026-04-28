"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  clearVotingSessionCookie,
  getVotingSessionIdFromCookie,
} from "@/lib/voting/session-cookie";
import { sendVoterReceiptEmail } from "@/lib/email/vote-receipt";
import { getVotePageCatalog } from "@/lib/voting/vote-catalog";
import { getVotingWindow, getVotingWindowStatus } from "@/lib/voting/voting-window";

export type BallotChoicePayload = {
  geo_group_id: number;
  candidate_ids: string[];
};

const REQUIRED_PICKS_PER_GEO_GROUP = 3;

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

  // Do not accept submissions outside the voting window.
  try {
    const window = await getVotingWindow();
    const status = getVotingWindowStatus(window);
    if (status.kind !== "open") {
      return { error: "Voting is currently closed." };
    }
  } catch {
    return { error: "Unable to validate voting window right now. Please try again." };
  }

  // Server-side enforcement: exactly 3 picks per geo group that has nominees.
  try {
    const { geoGroups, candidates } = await getVotePageCatalog();
    const candidatesByGeo = new Map<number, Set<string>>();
    for (const c of candidates) {
      if (c.geo_group_id == null) continue;
      if (!candidatesByGeo.has(c.geo_group_id)) candidatesByGeo.set(c.geo_group_id, new Set());
      candidatesByGeo.get(c.geo_group_id)!.add(String(c.id));
    }

    const byGeo = new Map<number, BallotChoicePayload>();
    for (const ch of choices) {
      if (!ch || typeof ch.geo_group_id !== "number" || !Array.isArray(ch.candidate_ids)) {
        return { error: "Invalid ballot data. Go back and try again." };
      }
      byGeo.set(ch.geo_group_id, { geo_group_id: ch.geo_group_id, candidate_ids: ch.candidate_ids.map(String) });
    }

    for (const g of geoGroups) {
      const pool = candidatesByGeo.get(g.id);
      if (!pool || pool.size === 0) continue; // no nominees -> no required picks

      const entry = byGeo.get(g.id);
      const ids = entry?.candidate_ids ?? [];
      const unique = new Set(ids);
      if (unique.size !== ids.length) {
        return { error: `Duplicate selections detected in ${g.name}. Please review and try again.` };
      }
      if (ids.length !== REQUIRED_PICKS_PER_GEO_GROUP) {
        return { error: `Select exactly ${REQUIRED_PICKS_PER_GEO_GROUP} candidates in ${g.name}.` };
      }
      for (const id of ids) {
        if (!pool.has(id)) {
          return { error: `Invalid selection detected in ${g.name}. Please review and try again.` };
        }
      }
    }
  } catch {
    return { error: "Unable to validate ballot right now. Please try again." };
  }

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

  // Best-effort email receipt. Do not block the happy path if email fails.
  try {
    await sendVoterReceiptEmail(sessionId);
  } catch (e) {
    console.error("send voter receipt email failed", e);
  }

  await clearVotingSessionCookie();
  redirect("/vote/thanks");
}
