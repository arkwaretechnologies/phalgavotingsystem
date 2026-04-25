import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Public lobby board: verified voters in `queued` sessions + all tablet statuses
 * (for vacant-station detection on the client). Uses service role like `/api/tablet/state`.
 */
export async function GET() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: sessions, error: sErr }, { data: tablets, error: tErr }] = await Promise.all([
    supabase
      .from("voting_sessions")
      .select("queue_number, voter_id, status")
      .eq("status", "queued")
      .order("queue_number", { ascending: true }),
    supabase.from("tablets").select("id, label, status").order("id", { ascending: true }),
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

  const queue_numbers = sessionList
    .filter((s) => s.voter_id && verifiedIds.has(s.voter_id))
    .map((s) => Number(s.queue_number))
    .filter((n) => Number.isFinite(n));

  return NextResponse.json(
    {
      queue_numbers,
      tablets: tablets ?? [],
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
