"use server";

import bcrypt from "bcryptjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/session";
import { isSystemSuperSession } from "@/lib/admin/admin-roles";

export type VerifyFinalTallyState = { error: string } | { ok: true } | null;

export async function verifyFinalTallyForCanvass(
  _prev: VerifyFinalTallyState,
  formData: FormData,
): Promise<VerifyFinalTallyState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Enter your admin username and password to confirm." };
  }

  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized." };
  if (!isSystemSuperSession(session)) {
    return { error: "Only a super admin can close the election and unlock the canvass report." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, username, password_hash")
    .eq("id", session.admin_user_id)
    .maybeSingle();

  if (error || !user?.password_hash) {
    return { error: "Unable to verify your account." };
  }

  const dbUser = user as { id: number; username: string | null; password_hash: string };
  const dbUsername = String(dbUser.username ?? "").trim();
  if (dbUsername !== username) {
    return { error: "Username must match the account you are signed in with." };
  }

  const ok = await bcrypt.compare(password, dbUser.password_hash);
  if (!ok) return { error: "Invalid password." };

  const { error: upErr } = await supabase
    .from("app_settings")
    .update({ voting_status: "closed", updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (upErr) {
    return { error: "Unable to close election status. Please try again." };
  }

  return { ok: true };
}
