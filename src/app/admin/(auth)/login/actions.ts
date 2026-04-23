"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { setAdminSession } from "@/lib/admin/session";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function adminLogin(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) throw new Error("Username and password are required");

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, username, password_hash, full_name, role")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("admin login query failed", error);
    const { message } = toPublicMessage(error, "Unable to sign in right now. Please try again.");
    redirect(`/admin/login?error=${encodeURIComponent(message)}`);
  }
  if (!user?.password_hash) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("Invalid credentials");

  const role = user.role;
  if (role !== "super_admin" && role !== "admin" && role !== "personnel") {
    throw new Error("Invalid role");
  }

  await setAdminSession({
    admin_user_id: user.id,
    role,
    full_name: user.full_name ?? null,
  });

  redirect("/admin");
}

