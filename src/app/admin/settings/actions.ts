"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { toPublicMessage } from "@/lib/errors/public-message";

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
    if (confErr) {
      // eslint-disable-next-line no-console
      console.error("setActiveConfcode validate failed", confErr);
      const { message } = toPublicMessage(confErr, "Unable to validate conference code.");
      redirect(`/admin/settings/conference?error=${encodeURIComponent(message)}`);
    }
    if (!conf) throw new Error("Conference code not found");
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, active_confcode, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("setActiveConfcode upsert failed", error);
    const { message } = toPublicMessage(error, "Unable to save settings. Please try again.");
    redirect(`/admin/settings/conference?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/conference");
  revalidatePath("/vote");
}

