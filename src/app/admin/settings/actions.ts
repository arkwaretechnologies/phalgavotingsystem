"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function setActiveConfcode(formData: FormData) {
  const confcodeRaw = String(formData.get("active_confcode") ?? "").trim();
  const active_confcode = confcodeRaw && confcodeRaw !== "null" ? confcodeRaw : null;

  const supabase = createSupabaseServiceRoleClient();

  if (active_confcode) {
    const { data: conf, error: confErr } = await supabase
      .from("conference")
      .select("confcode")
      .eq("confcode", active_confcode)
      .maybeSingle();
    if (confErr) throw new Error(confErr.message);
    if (!conf) throw new Error("Conference code not found");
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, active_confcode, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  revalidatePath("/vote");
}

