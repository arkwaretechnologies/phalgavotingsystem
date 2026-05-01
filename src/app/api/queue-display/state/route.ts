import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getVotingWindow, getVotingWindowStatus } from "@/lib/voting/voting-window";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

/**
 * Public lobby board: verified voters in `queued` sessions + all tablet statuses
 * (for vacant-station detection on the client). Uses service role like `/api/tablet/state`.
 */
export async function GET() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: sessions, error: sErr }, { data: tablets, error: tErr }, votingWindowRaw] =
    await Promise.all([
      (async () => {
        try {
          const data = await fetchAllRows<{
            queue_number: number;
            voter_id: string | null;
            status: string | null;
            tablet_id: number | null;
          }>(
            async (from, to) =>
              await supabase
                .from("voting_sessions")
                .select("queue_number, voter_id, status, tablet_id")
                .in("status", ["queued", "voting"])
                .order("queue_number", { ascending: true })
                .order("id", { ascending: true })
                .range(from, to),
          );
          return { data, error: null as any };
        } catch (e) {
          return { data: null, error: { message: String((e as any)?.message ?? e) } };
        }
      })(),
      (async () => {
        try {
          const data = await fetchAllRows<{ id: string; label: string | null; status: string | null }>(
            async (from, to) =>
              await supabase
              .from("tablets")
              .select("id, label, status")
              .order("id", { ascending: true })
              .range(from, to),
          );
          return { data, error: null as any };
        } catch (e) {
          return { data: null, error: { message: String((e as any)?.message ?? e) } };
        }
      })(),
      getVotingWindow(),
    ]);

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const sessionList = sessions ?? [];
  const voterIds = [
    ...new Set(sessionList.map((s) => s.voter_id).filter((id): id is string => Boolean(id))),
  ];

  let verifiedIds = new Set<string>();
  if (voterIds.length > 0) {
    const { data: voters, error: vErr } = await supabase
      .from("voters")
      .select("id")
      .in("id", voterIds)
      .eq("is_verified", true);
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
    verifiedIds = new Set((voters ?? []).map((v) => v.id as string));
  }

  const verifiedRows = sessionList.filter((s) => s.voter_id && verifiedIds.has(s.voter_id));

  const queue_numbers = verifiedRows
    .filter((s) => s.status === "queued")
    .map((s) => Number(s.queue_number))
    .filter((n) => Number.isFinite(n));

  const active_voting = verifiedRows
    .filter((s) => s.status === "voting")
    .map((s) => ({
      queue_number: Number(s.queue_number),
      tablet_id: s.tablet_id == null || Number.isNaN(Number(s.tablet_id)) ? null : Number(s.tablet_id),
    }))
    .filter((r) => Number.isFinite(r.queue_number));

  const wStatus = getVotingWindowStatus(votingWindowRaw);
  const votingWindow = {
    start: votingWindowRaw.start,
    end: votingWindowRaw.end,
    status: wStatus.kind,
    msRemaining:
      wStatus.kind === "open"
        ? wStatus.remainingMs
        : wStatus.kind === "not_started"
          ? wStatus.startsInMs
          : null,
  } as const;

  const now = new Date().toISOString();

  return NextResponse.json(
    {
      queue_numbers,
      active_voting,
      tablets: tablets ?? [],
      now,
      votingWindow,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
