"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSystemSuperSession } from "@/lib/admin/admin-roles";
import { normalizePageKeysFromForm, allAdminPageKeys } from "@/lib/admin/admin-page-keys";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { SYSTEM_SUPER_SLUG } from "@/lib/admin/role-types";

const ROLES_PATH = "/admin/settings/roles";
const MAX_NAME_LEN = 50;

function redirectError(message: string): never {
  redirect(`${ROLES_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(message: string): never {
  redirect(`${ROLES_PATH}?toast=success&message=${encodeURIComponent(message)}`);
}

async function requireSystemSuperOrRedirect() {
  const session = await getAdminSession();
  if (!session || !isSystemSuperSession(session)) {
    redirectError("You do not have permission to do that.");
  }
  return session;
}

function readPresetFromFormData(formData: FormData, roleId: number) {
  const all = allAdminPageKeys();
  return all.filter((k) => {
    const v = formData.get(`preset__${roleId}__${k}`);
    return v === "1" || v === "on" || v === "true";
  });
}

function revalidateRolePaths() {
  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin");
  revalidatePath("/admin", "layout");
}

async function replaceRolePages(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  roleId: number,
  pageKeys: string[],
  updatedAt: string
) {
  const { error: dErr } = await supabase.from("role_pages").delete().eq("role_id", roleId);
  if (dErr) {
    // eslint-disable-next-line no-console
    console.error("replaceRolePages delete", dErr);
    return dErr;
  }
  if (pageKeys.length > 0) {
    const { error: iErr } = await supabase.from("role_pages").insert(
      pageKeys.map((page_key) => ({ role_id: roleId, page_key }))
    );
    if (iErr) {
      // eslint-disable-next-line no-console
      console.error("replaceRolePages insert", iErr);
      return iErr;
    }
  }
  const { error: uErr } = await supabase
    .from("roles")
    .update({ updated_at: updatedAt })
    .eq("role_id", roleId);
  if (uErr) {
    // eslint-disable-next-line no-console
    console.error("replaceRolePages touch roles", uErr);
    return uErr;
  }
  return null;
}

/**
 * Save `role_pages` for every role (form fields `preset__<roleId>__<pageKey>`). Full-access roles
 * get a full set of rows for reference.
 */
export async function saveAllRolePresets(formData: FormData) {
  await requireSystemSuperOrRedirect();
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { data: roles, error: rErr } = await supabase
    .from("roles")
    .select("role_id, is_full_access, slug")
    .order("role_id", { ascending: true });
  if (rErr || !roles?.length) {
    const { message } = toPublicMessage(rErr, "Unable to load roles.");
    redirectError(message);
  }

  for (const r of roles) {
    const row = r as { role_id: number; is_full_access: boolean; slug: string };
    if (row.is_full_access) {
      const uErr = await replaceRolePages(supabase, row.role_id, allAdminPageKeys(), now);
      if (uErr) {
        const { message } = toPublicMessage(uErr, "Unable to save role permissions.");
        redirectError(message);
      }
      continue;
    }

    const selected = readPresetFromFormData(formData, row.role_id);
    if (selected.length === 0) {
      redirectError("Select at least one page for each custom role (see role labels in the form).");
    }
    const allowed = normalizePageKeysFromForm(selected);
    const e = await replaceRolePages(supabase, row.role_id, allowed, now);
    if (e) {
      // eslint-disable-next-line no-console
      console.error("saveAllRolePresets", row.role_id, e);
      const { message } = toPublicMessage(e, "Unable to save role permissions.");
      redirectError(message);
    }
  }

  revalidateRolePaths();
  redirectSuccess("Role permissions saved.");
}

/**
 * Save `role_pages` for a single role (form: hidden `role_id` + `preset__<id>__<pageKey>` checkboxes).
 */
export async function saveSingleRolePresets(formData: FormData) {
  await requireSystemSuperOrRedirect();
  const roleId = Number(String(formData.get("role_id") ?? "").trim());
  if (!Number.isFinite(roleId) || roleId <= 0) redirectError("Invalid role.");

  const supabase = createSupabaseServiceRoleClient();
  const { data: roleRow, error: lErr } = await supabase
    .from("roles")
    .select("role_id, is_full_access, slug")
    .eq("role_id", roleId)
    .maybeSingle();
  if (lErr || !roleRow) {
    const { message } = toPublicMessage(lErr, "Role not found.");
    redirectError(message);
  }
  const row = roleRow as { role_id: number; is_full_access: boolean; slug: string };
  const now = new Date().toISOString();

  if (row.is_full_access) {
    const uErr = await replaceRolePages(supabase, roleId, allAdminPageKeys(), now);
    if (uErr) {
      const { message } = toPublicMessage(uErr, "Unable to save role permissions.");
      redirectError(message);
    }
  } else {
    const selected = readPresetFromFormData(formData, roleId);
    if (selected.length === 0) {
      redirectError("Select at least one page.");
    }
    const allowed = normalizePageKeysFromForm(selected);
    const e = await replaceRolePages(supabase, roleId, allowed, now);
    if (e) {
      const { message } = toPublicMessage(e, "Unable to save role permissions.");
      redirectError(message);
    }
  }
  revalidateRolePaths();
  redirectSuccess("Permissions updated.");
}

const SLUG_RE = /^[a-z0-9_]{2,64}$/;

export async function createAdminRole(formData: FormData) {
  await requireSystemSuperOrRedirect();
  const label = String(formData.get("label") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  if (!label) redirectError("Label is required.");
  if (label.length > MAX_NAME_LEN) {
    redirectError(`Name must be at most ${MAX_NAME_LEN} characters.`);
  }
  if (!SLUG_RE.test(slug)) {
    redirectError("Slug must be 2–64 characters: lowercase letters, numbers, and underscores only.");
  }
  if (slug === SYSTEM_SUPER_SLUG) {
    redirectError("That slug is reserved for the system super role.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: nextOrder } = await supabase
    .from("roles")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order =
    (nextOrder as { sort_order?: number } | null)?.sort_order != null
      ? Number((nextOrder as { sort_order: number }).sort_order) + 1
      : 100;

  const now = new Date().toISOString();
  const { data: ins, error: insErr } = await supabase
    .from("roles")
    .insert({
      name: label,
      description: null,
      slug,
      is_system: false,
      is_full_access: false,
      sort_order,
      created_at: now,
      updated_at: now,
    })
    .select("role_id")
    .maybeSingle();
  if (insErr) {
    if (String(insErr.message ?? "").toLowerCase().includes("unique")) {
      redirectError("That role slug or name is already in use.");
    }
    const { message } = toPublicMessage(insErr, "Unable to create role.");
    redirectError(message);
  }
  const roleId = (ins as { role_id: number } | null)?.role_id;
  if (!roleId) redirectError("Could not create role.");

  const pErr = await replaceRolePages(supabase, roleId, allAdminPageKeys(), now);
  if (pErr) {
    // eslint-disable-next-line no-console
    console.error("createAdminRole role_pages", pErr);
    await supabase.from("roles").delete().eq("role_id", roleId);
    const { message } = toPublicMessage(pErr, "Role was created but presets failed. Try again.");
    redirectError(message);
  }

  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin", "layout");
  redirectSuccess("Role created.");
}

export async function deleteAdminRole(formData: FormData) {
  await requireSystemSuperOrRedirect();
  const id = Number(String(formData.get("role_id") ?? "").trim());
  if (!Number.isFinite(id) || id <= 0) redirectError("Invalid role.");

  const supabase = createSupabaseServiceRoleClient();
  const { data: role, error: lErr } = await supabase
    .from("roles")
    .select("role_id, is_system, slug, is_full_access")
    .eq("role_id", id)
    .maybeSingle();
  if (lErr || !role) {
    redirectError("Role not found.");
  }
  const r = role as { is_system: boolean; slug: string; is_full_access: boolean };
  if (r.is_system || r.slug === SYSTEM_SUPER_SLUG) {
    redirectError("This role cannot be removed.");
  }

  const { count } = await supabase
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .eq("role_id", id);
  if ((count ?? 0) > 0) {
    redirectError("Reassign or remove users with this role before deleting it.");
  }

  const { error: dErr } = await supabase.from("roles").delete().eq("role_id", id);
  if (dErr) {
    const { message } = toPublicMessage(dErr, "Unable to delete role.");
    redirectError(message);
  }

  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin", "layout");
  redirectSuccess("Role removed.");
}

export async function resetAllRolePresetsToFullAccess() {
  await requireSystemSuperOrRedirect();
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const allKeys = allAdminPageKeys();

  const { data: roles, error: rErr } = await supabase.from("roles").select("role_id");
  if (rErr) {
    const { message } = toPublicMessage(rErr, "Unable to load roles.");
    redirectError(message);
  }

  for (const r of roles ?? []) {
    const roleId = Number((r as { role_id: number }).role_id);
    if (!Number.isFinite(roleId)) continue;
    const uErr = await replaceRolePages(supabase, roleId, allKeys, now);
    if (uErr) {
      const { message } = toPublicMessage(uErr, "Unable to reset permissions.");
      redirectError(message);
    }
  }

  revalidateRolePaths();
  redirectSuccess("All role presets set to full page access.");
}
