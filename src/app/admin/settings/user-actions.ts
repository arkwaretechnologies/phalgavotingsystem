"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

const SALT = 10;

type AdminUserRole = "super_admin" | "admin" | "personnel";

async function requireSuperAdmin() {
  const session = await getAdminSession();
  if (!session || session.role !== "super_admin") {
    throw new Error("You do not have permission to do that.");
  }
  return session;
}

function parseRole(v: string): AdminUserRole | null {
  if (v === "super_admin" || v === "admin" || v === "personnel") return v;
  return null;
}

export async function createAdminUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const role = parseRole(String(formData.get("role") ?? ""));

  if (!username) throw new Error("Username is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!role) throw new Error("Invalid role.");

  const password_hash = await bcrypt.hash(password, SALT);
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("admin_users").insert({
    username,
    password_hash,
    full_name,
    role,
  });
  if (error) {
    if (String(error.message ?? "").toLowerCase().includes("unique")) {
      throw new Error("That username is already in use.");
    }
    // eslint-disable-next-line no-console
    console.error("createAdminUser failed", error);
    const { message } = toPublicMessage(error, "Unable to create user.");
    throw new Error(message);
  }

  revalidatePath("/admin/settings/users");
}

export async function updateAdminUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const id = Number(String(formData.get("id") ?? "").trim());
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid user.");

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const role = parseRole(String(formData.get("role") ?? ""));

  if (!username) throw new Error("Username is required.");
  if (!role) throw new Error("Invalid role.");

  const supabase = createSupabaseServiceRoleClient();

  const { data: before, error: loadErr } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    const { message } = toPublicMessage(loadErr, "Unable to update user.");
    throw new Error(message);
  }
  if (!before) throw new Error("User not found.");

  if (id === session.admin_user_id && role !== "super_admin") {
    throw new Error("You cannot remove your own super admin role.");
  }

  if (role !== "super_admin" && (before as { role?: string }).role === "super_admin") {
    const { count, error: countErr } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (countErr) {
      // eslint-disable-next-line no-console
      console.error("count super_admins", countErr);
    }
    if ((count ?? 0) <= 1) {
      throw new Error("There must be at least one super admin account.");
    }
  }

  const updatePayload: {
    username: string;
    full_name: string | null;
    role: AdminUserRole;
    password_hash?: string;
  } = { username, full_name, role };

  if (password.length > 0) {
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    updatePayload.password_hash = await bcrypt.hash(password, SALT);
  }

  const { error } = await supabase.from("admin_users").update(updatePayload).eq("id", id);
  if (error) {
    if (String(error.message ?? "").toLowerCase().includes("unique")) {
      throw new Error("That username is already in use.");
    }
    // eslint-disable-next-line no-console
    console.error("updateAdminUser failed", error);
    const { message } = toPublicMessage(error, "Unable to update user.");
    throw new Error(message);
  }

  revalidatePath("/admin/settings/users");
}

export async function deleteAdminUser(id: number) {
  const session = await requireSuperAdmin();
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid user.");
  if (id === session.admin_user_id) {
    throw new Error("You cannot delete your own account.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: target, error: loadErr } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    const { message } = toPublicMessage(loadErr, "Unable to delete user.");
    throw new Error(message);
  }
  if (!target) throw new Error("User not found.");

  if ((target as { role?: string }).role === "super_admin") {
    const { count, error: countErr } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (countErr) {
      // eslint-disable-next-line no-console
      console.error("count super_admins", countErr);
    }
    if ((count ?? 0) <= 1) {
      throw new Error("The last super admin account cannot be deleted.");
    }
  }

  const { error } = await supabase.from("admin_users").delete().eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("deleteAdminUser failed", error);
    const { message } = toPublicMessage(error, "Unable to delete user.");
    throw new Error(message);
  }

  revalidatePath("/admin/settings/users");
}
