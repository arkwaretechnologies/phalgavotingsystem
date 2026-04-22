"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function claimPairCode(formData: FormData) {
  const code = String(formData.get("pair_code") ?? "").trim();
  const deviceIdRaw = String(formData.get("device_id") ?? "").trim();
  const deviceId = deviceIdRaw || crypto.randomUUID();

  if (!code) throw new Error("Pairing code is required");

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("claim_tablet_pair_code", {
    p_pair_code: code,
    p_device_id: deviceId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Unable to claim code");

  redirect(`/tablet/pair/success?tablet=${encodeURIComponent(String(data))}`);
}

