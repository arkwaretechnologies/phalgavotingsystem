import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tabletIdRaw = url.searchParams.get("tablet_id") ?? "";
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) {
    return NextResponse.json({ error: "invalid tablet_id" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const [{ data: tablet, error: tErr }, { data: queue, error: qErr }] = await Promise.all([
    supabase
      .from("tablets")
      .select("id, label, status, current_session, last_active_at")
      .eq("id", tabletId)
      .maybeSingle(),
    supabase
      .from("voting_sessions")
      .select("id, queue_number, status, tablet_id")
      .in("status", ["queued", "voting"])
      .order("queue_number", { ascending: true })
      .limit(20),
  ]);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  return NextResponse.json(
    {
      tablet,
      queue: queue ?? [],
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

