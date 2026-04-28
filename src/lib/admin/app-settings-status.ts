import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function getAppSettingsStatus(): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data } = await supabase
    .from("app_settings")
    .select("voting_status")
    .eq("id", 1)
    .maybeSingle();

  const row = (data ?? null) as Record<string, unknown> | null;
  const raw = row?.voting_status ?? null;
  const s = raw == null ? "" : String(raw).trim();
  return s ? s.toLowerCase() : null;
}

