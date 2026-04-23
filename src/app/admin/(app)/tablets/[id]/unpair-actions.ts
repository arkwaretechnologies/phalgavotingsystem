"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tablets/${tabletId}`);
  redirect(`/admin/tablets/${tabletId}`);
}

