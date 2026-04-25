"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getSuperAdminRoleId, isSystemSuperSession } from "@/lib/admin/admin-roles";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

const SALT = 10;

async function requireSystemSuper() {
  const session = await getAdminSession();
  if (!session || !isSystemSuperSession(session)) {
    throw new Error("You do not have permission to do that.");
  }
  return session;
}

export async function createAdminUser(formData: FormData) {
  await requireSystemSuper();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const role_id = Number(String(formData.get("role_id") ?? "").trim());

  if (!username) throw new Error("Username is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!Number.isFinite(role_id) || role_id <= 0) throw new Error("Select a valid role.");

  const password_hash = await bcrypt.hash(password, SALT);
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("admin_users").insert({
    username,
    password_hash,
    full_name,
    role_id,
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
  const session = await requireSystemSuper();
  const id = Number(String(formData.get("id") ?? "").trim());
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid user.");

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const role_id = Number(String(formData.get("role_id") ?? "").trim());

  if (!username) throw new Error("Username is required.");
  if (!Number.isFinite(role_id) || role_id <= 0) throw new Error("Select a valid role.");

  const supabase = createSupabaseServiceRoleClient();
  const superId = await getSuperAdminRoleId();
  if (superId == null) throw new Error("System configuration error: no super role.");

  const { data: before, error: loadErr } = await supabase
    .from("admin_users")
    .select("id, role_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    const { message } = toPublicMessage(loadErr, "Unable to update user.");
    throw new Error(message);
  }
  if (!before) throw new Error("User not found.");

  const beforeRole = Number((before as { role_id: number }).role_id);

  if (id === session.admin_user_id && role_id !== superId) {
    throw new Error("You cannot remove your own system super access.");
  }

  if (beforeRole === superId && role_id !== superId) {
    const { count, error: countErr } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role_id", superId);
    if (countErr) {
      // eslint-disable-next-line no-console
      console.error("count super users", countErr);
    }
    if ((count ?? 0) <= 1) {
      throw new Error("There must be at least one system super account.");
    }
  }

  const updatePayload: {
    username: string;
    full_name: string | null;
    role_id: number;
    password_hash?: string;
  } = { username, full_name, role_id };

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
  const session = await requireSystemSuper();
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid user.");
  if (id === session.admin_user_id) {
    throw new Error("You cannot delete your own account.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const superId = await getSuperAdminRoleId();
  if (superId == null) throw new Error("System configuration error: no super role.");

  const { data: target, error: loadErr } = await supabase
    .from("admin_users")
    .select("id, role_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    const { message } = toPublicMessage(loadErr, "Unable to delete user.");
    throw new Error(message);
  }
  if (!target) throw new Error("User not found.");

  if (Number((target as { role_id: number }).role_id) === superId) {
    const { count, error: countErr } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role_id", superId);
    if (countErr) {
      // eslint-disable-next-line no-console
      console.error("count super users", countErr);
    }
    if ((count ?? 0) <= 1) {
      throw new Error("The last system super account cannot be deleted.");
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
