"use server";

import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { setTabletSessionCookie } from "@/lib/tablet/session";

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
  if (error) {
    const msg = error.message || "Unable to claim code";
    if (msg.toLowerCase().includes("tablet already paired")) {
      redirect("/tablet/pair?toast=error&message=Tablet%20already%20paired.");
    }
    if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("code already expired")) {
      redirect("/tablet/pair?toast=error&message=Pairing%20code%20already%20expired.");
    }
    redirect(`/tablet/pair?toast=error&message=${encodeURIComponent(msg)}`);
  }
  if (!data) throw new Error("Unable to claim code");

  const tabletId = Number(data);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Unable to claim code");

  // Bind this device to the tablet via an HttpOnly signed cookie. Subsequent
  // tablet actions and the polling endpoint verify the cookie's tablet_id
  // matches the form-supplied tablet_id, so a stolen / guessed tablet number
  // alone cannot drive queue assignments.
  await setTabletSessionCookie({ tablet_id: tabletId, device_id: deviceId });

  redirect(`/tablet/pair/success?tablet=${encodeURIComponent(String(tabletId))}`);
}

