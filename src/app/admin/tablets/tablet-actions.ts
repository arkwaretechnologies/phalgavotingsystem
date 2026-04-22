"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function createTablet(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tablets").insert({
    label,
    status: "offline",
    current_session: null,
    last_active_at: null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/tablets");
}

