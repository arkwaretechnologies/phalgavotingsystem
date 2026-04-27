"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function adminUnpairTablet(formData: FormData) {
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Invalid tablet id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("unpair_tablet", {
    p_tablet_id: tabletId,
    p_device_id: null,
    p_by: "admin",
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("unpair_tablet(admin) failed", error);
    const { message } = toPublicMessage(error, "Unable to unpair tablet. Please try again.");
    redirect(`/admin/tablets/${tabletId}?error=${encodeURIComponent(message)}`);
  }

  // Best-effort detach any session pairing row on unpair.
  const { error: tpErr } = await supabase.from("table_pairings").delete().eq("tablet_id", tabletId);
  if (tpErr) {
    // eslint-disable-next-line no-console
    console.error("delete table_pairings after unpair(admin) failed", tpErr);
  }

  // Ensure tablet status reflects unpaired/offline state.
  const { error: tErr } = await supabase
    .from("tablets")
    .update({ status: "offline", current_session: null, last_active_at: new Date().toISOString() })
    .eq("id", tabletId);
  if (tErr) {
    // eslint-disable-next-line no-console
    console.error("set tablet offline after unpair(admin) failed", tErr);
  }

  revalidatePath(`/admin/tablets/${tabletId}`);
  redirect(`/admin/tablets/${tabletId}`);
}

