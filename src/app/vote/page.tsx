import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVotingSessionIdFromCookie } from "@/lib/voting/session-cookie";

export default async function VoteHomePage() {
  const votingSessionId = await getVotingSessionIdFromCookie();
  if (!votingSessionId) redirect("/vote/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: geoGroups, error: geoErr }, { data: candidates, error: candErr }] =
    await Promise.all([
      supabase
        .from("geo_groups")
        .select("id, code, name, max_votes, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("candidates")
        .select("id, geo_group_id, full_name, photo_url, bio")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
    ]);

  if (geoErr) throw new Error(geoErr.message);
  if (candErr) throw new Error(candErr.message);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Cast your votes</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Voting session: <span className="font-mono">{votingSessionId}</span>
      </p>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Next: voting UI</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Geo groups loaded: {geoGroups?.length ?? 0}, candidates loaded:{" "}
          {candidates?.length ?? 0}.
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          I’ll now implement the multi-tab selection UI (max {geoGroups?.[0]?.max_votes ?? 3} per
          group), a review screen, and submission via the `submit_ballot` RPC.
        </p>
      </div>
    </main>
  );
}

