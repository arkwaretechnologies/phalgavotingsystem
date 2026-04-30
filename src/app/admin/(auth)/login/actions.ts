"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAdminRoleByUserRoleId } from "@/lib/admin/fetch-admin-role-by-id";
import { setAdminSession } from "@/lib/admin/session";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function adminLogin(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect(`/admin/login?error=${encodeURIComponent("Username and password are required.")}`);
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, username, password_hash, full_name, role_id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("admin login query failed", error);
    const { message } = toPublicMessage(error, "Unable to sign in right now. Please try again.");
    redirect(`/admin/login?error=${encodeURIComponent(message)}`);
  }
  if (!user?.password_hash) {
    redirect(`/admin/login?error=${encodeURIComponent("Invalid credentials.")}`);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    redirect(`/admin/login?error=${encodeURIComponent("Invalid credentials.")}`);
  }

  const roleId = Number((user as { role_id?: unknown }).role_id);
  if (!Number.isFinite(roleId) || roleId <= 0) {
    // eslint-disable-next-line no-console
    console.error("admin user has invalid role_id", user);
    throw new Error("Invalid account configuration. Ask a super admin to fix this user’s role.");
  }

  const roleRow = await fetchAdminRoleByUserRoleId(roleId);
  if (!roleRow) {
    // eslint-disable-next-line no-console
    console.error("admin role missing for role_id (check roles / admin_roles + migrations)", roleId);
    throw new Error(
      "This account’s role was not found. In Supabase, apply pending migrations (create `roles` / `role_pages` and the INSERT seed), or set `admin_users.role_id` to a valid `roles.role_id`.",
    );
  }

  const role_slug = roleRow.slug;
  const is_full_access = roleRow.is_full_access;
  if (!role_slug) throw new Error("Invalid account role.");

  await setAdminSession({
    admin_user_id: user.id,
    admin_role_id: roleId,
    role_slug,
    is_full_access,
    full_name: user.full_name ?? null,
  });

  redirect("/admin");
}
