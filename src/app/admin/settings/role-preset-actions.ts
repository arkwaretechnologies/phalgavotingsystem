"use server";

import { revalidatePath } from "next/cache";
import { normalizePageKeysFromForm, allAdminPageKeys } from "@/lib/admin/admin-page-keys";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import type { AdminUserRole } from "@/lib/admin/role-presets";

async function requireSuperAdmin() {
  const session = await getAdminSession();
  if (!session || session.role !== "super_admin") {
    throw new Error("You do not have permission to do that.");
  }
  return session;
}

function readKeysFromFormData(formData: FormData, prefix: string) {
  const all = allAdminPageKeys();
  return all.filter((k) => {
    const v = formData.get(`${prefix}__${k}`);
    return v === "1" || v === "on" || v === "true";
  });
}

/**
 * Submits all three roles' presets from a single form: keys like `admin__dashboard`, `personnel__queueing`.
 * `super_admin` is always all pages in DB for consistency.
 */
export async function saveAllRolePresets(formData: FormData) {
  await requireSuperAdmin();
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const allKeys = allAdminPageKeys();

  for (const role of ["admin", "personnel"] as const) {
    const selected = readKeysFromFormData(formData, role);
    if (selected.length === 0) {
      throw new Error("Select at least one page for each role (or ask a super admin to fix access).");
    }
    const allowed = normalizePageKeysFromForm(selected);
    const { error } = await supabase.from("admin_role_presets").upsert(
      {
        role,
        allowed_page_keys: allowed,
        updated_at: now,
      },
      { onConflict: "role" }
    );
    if (error) {
      // eslint-disable-next-line no-console
      console.error("saveAllRolePresets", role, error);
      const { message } = toPublicMessage(error, "Unable to save role permissions.");
      throw new Error(message);
    }
  }

  const { error: sErr } = await supabase.from("admin_role_presets").upsert(
    {
      role: "super_admin" as AdminUserRole,
      allowed_page_keys: allKeys,
      updated_at: now,
    },
    { onConflict: "role" }
  );
  if (sErr) {
    // eslint-disable-next-line no-console
    console.error("saveAllRolePresets super_admin", sErr);
    const { message } = toPublicMessage(sErr, "Unable to save role permissions.");
    throw new Error(message);
  }

  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin");
}
