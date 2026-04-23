import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "phalga_voting_session";

/**
 * Called when the voter leaves /vote without submitting (tab close, refresh, navigation).
 * Reverts `voting` → `queued`, frees the tablet if any, and clears the session cookie.
 * No-op if session is already `voted` or not in `voting`.
 */
export async function POST() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;

  if (!sessionId || sessionId === "dev-bypass") {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: row, error: selErr } = await supabase
    .from("voting_sessions")
    .select("tablet_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (selErr || !row || row.status !== "voting") {
    jar.delete(SESSION_COOKIE);
    return new NextResponse(null, { status: 204 });
  }

  const tabletId = row.tablet_id as number | null;

  const { error: upErr } = await supabase
    .from("voting_sessions")
    .update({
      status: "queued",
      voted_via: null,
      session_start: null,
      session_end: null,
      tablet_id: null,
    })
    .eq("id", sessionId)
    .eq("status", "voting");

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (tabletId != null) {
    await supabase
      .from("tablets")
      .update({
        status: "vacant",
        current_session: null,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", tabletId);
  }

  jar.delete(SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
