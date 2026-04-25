"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function assignNextSession(formData: FormData) {
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Invalid tablet id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("assign_next_session", { p_tablet_id: tabletId });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("assign_next_session failed", error);
    const { message } = toPublicMessage(error, "Unable to assign next voter. Please try again.");
    redirect(`/tablet?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/tablet");
}

export async function markTabletVacant(formData: FormData) {
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Invalid tablet id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("tablets")
    .update({ status: "vacant", current_session: null, last_active_at: new Date().toISOString() })
    .eq("id", tabletId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("markTabletVacant failed", error);
    const { message } = toPublicMessage(error, "Unable to update tablet. Please try again.");
    redirect(`/tablet?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/tablet");
}

export async function unpairTabletFromDevice(formData: FormData) {
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const deviceId = String(formData.get("device_id") ?? "").trim();
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Invalid tablet id");
  if (!deviceId) throw new Error("Missing device id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("unpair_tablet", {
    p_tablet_id: tabletId,
    p_device_id: deviceId,
    p_by: "device",
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("unpair_tablet(device) failed", error);
    const { message } = toPublicMessage(error, "Unable to unpair. Ask admin for help.");
    redirect(`/tablet?error=${encodeURIComponent(message)}`);
  }

  // Ensure tablet status reflects unpaired/offline state.
  const { error: tErr } = await supabase
    .from("tablets")
    .update({ status: "offline", current_session: null, last_active_at: new Date().toISOString() })
    .eq("id", tabletId);
  if (tErr) {
    // eslint-disable-next-line no-console
    console.error("set tablet offline after unpair(device) failed", tErr);
  }

  revalidatePath("/tablet");
  redirect("/tablet/pair?unpaired=1");
}

