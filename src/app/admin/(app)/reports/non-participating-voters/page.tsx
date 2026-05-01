import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toPublicMessage } from "@/lib/errors/public-message";
import {
  NonParticipatingVotersClient,
  type NonParticipatingVoterRow,
} from "./non-participating-voters-client";

type VoterRow = NonParticipatingVoterRow;

type SubmittedBallotRow = {
  voter_id: string | null;
};

export default async function NonParticipatingVotersReportPage() {
  const supabase = createSupabaseServiceRoleClient();

  let voters: VoterRow[] = [];
  let submittedVoterIds: Set<string> = new Set();

  try {
    const submitted = await fetchAllRows<SubmittedBallotRow>(
      (from, to) =>
        supabase
          .from("ballots")
          .select("voter_id")
          .eq("is_submitted", true)
          .order("created_at", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    );
    submittedVoterIds = new Set(
      submitted
        .map((r) => (r.voter_id ? String(r.voter_id) : ""))
        .filter((x) => x.length > 0),
    );

    voters = await fetchAllRows<VoterRow>(
      (from, to) =>
        supabase
          .from("voters")
          .select("id, full_name, position, lgu, province, email, phone")
          .order("full_name", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("non-participating voters report load failed", e);
    const { message } = toPublicMessage(e, "Unable to load report right now.");
    throw new Error(message);
  }

  const rows = voters.filter((v) => !submittedVoterIds.has(v.id));

  return (
    <NonParticipatingVotersClient
      rows={rows}
      generatedAtIso={new Date().toISOString()}
    />
  );
}

