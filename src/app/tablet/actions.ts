"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function assignNextSession(formData: FormData) {
  const tabletIdRaw = String(formData.get("tablet_id") ?? "").trim();
  const tabletId = Number(tabletIdRaw);
  if (!Number.isFinite(tabletId) || tabletId <= 0) throw new Error("Invalid tablet id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("assign_next_session", { p_tablet_id: tabletId });
  if (error) throw new Error(error.message);

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
  if (error) throw new Error(error.message);

  revalidatePath("/tablet");
}

