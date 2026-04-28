"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/session";
import { isSystemSuperSession } from "@/lib/admin/admin-roles";
import { setFinalTallyGrant } from "@/lib/admin/final-tally-grant";

export async function requestFinalTally(_prev: { error?: string } | null, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Password is required." };

  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized." };
  if (!isSystemSuperSession(session)) {
    return { error: "Only a super admin can run Final Tally." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, password_hash")
    .eq("id", session.admin_user_id)
    .maybeSingle();

  if (error || !user?.password_hash) {
    return { error: "Unable to verify password." };
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { error: "Invalid password." };

  const { error: upErr } = await supabase
    .from("app_settings")
    .update({ voting_status: "closed", updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (upErr) {
    return { error: "Unable to close election status. Please try again." };
  }

  await setFinalTallyGrant(session.admin_user_id);
  redirect("/admin/canvass?toast=success&message=" + encodeURIComponent("Final tally unlocked."));
}

