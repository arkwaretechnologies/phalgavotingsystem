import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTabletSessionMatching } from "@/lib/tablet/session";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tabletIdRaw = url.searchParams.get("tablet_id") ?? "";
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) {
    return NextResponse.json({ error: "invalid tablet_id" }, { status: 400, headers: NO_STORE });
  }

  // Require a paired tablet session cookie whose tablet_id matches the request.
  // This blocks scraping internal session UUIDs by guessing tablet ids.
  const session = await getTabletSessionMatching(tabletId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
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
      // Hide skipped queued voters from the tablet's queue preview.
      .or("status.eq.voting,skipped_at.is.null")
      .order("queue_number", { ascending: true })
      .limit(20),
  ]);

  if (tErr) {
    // eslint-disable-next-line no-console
    console.error("/api/tablet/state load tablet failed", tErr);
    return NextResponse.json(
      { error: "Unable to load tablet state." },
      { status: 500, headers: NO_STORE },
    );
  }
  if (qErr) {
    // eslint-disable-next-line no-console
    console.error("/api/tablet/state load queue failed", qErr);
    return NextResponse.json(
      { error: "Unable to load tablet state." },
      { status: 500, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      tablet,
      queue: queue ?? [],
      now: new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}
