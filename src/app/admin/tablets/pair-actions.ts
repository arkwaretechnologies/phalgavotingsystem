"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

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
  if (error) {
    // eslint-disable-next-line no-console
    console.error("create_tablet_pair_code failed", error);
    const { message } = toPublicMessage(error, "Unable to generate pairing code. Please try again.");
    const dest0 = returnTo || `/admin/tablets/${tabletId}`;
    const join0 = dest0.includes("?") ? "&" : "?";
    redirect(`${dest0}${join0}error=${encodeURIComponent(message)}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const code = row?.pair_code;
  if (!code) throw new Error("No pairing code returned");

  const dest = returnTo || `/admin/tablets/${tabletId}`;
  const join = dest.includes("?") ? "&" : "?";
  redirect(`${dest}${join}code=${encodeURIComponent(code)}`);
}

