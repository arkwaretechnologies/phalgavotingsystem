"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function createPairCodeForTablet(formData: FormData) {
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Invalid tablet id");

  const returnTo = String(formData.get("return_to") ?? "").trim();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("create_tablet_pair_code", {
    p_tablet_id: tabletId,
    p_ttl_seconds: 300,
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  const code = row?.pair_code;
  if (!code) throw new Error("No pairing code returned");

  const dest = returnTo || `/admin/tablets/${tabletId}`;
  const join = dest.includes("?") ? "&" : "?";
  redirect(`${dest}${join}code=${encodeURIComponent(code)}`);
}

