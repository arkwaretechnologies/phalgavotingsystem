import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { AdminPageKey } from "./admin-page-keys";
import { allAdminPageKeys, isAdminPageKey } from "./admin-page-keys";
import { logSupabaseError } from "./admin-roles-helpers";
import type { AdminSessionPayload } from "./session";

const ALL = allAdminPageKeys();

export { SYSTEM_SUPER_SLUG } from "./role-types";
export type { AdminUserRole, AdminRoleWithPreset } from "./role-types";

/**
 * Page keys a role may access. Full-access roles ignore `role_pages` / legacy presets.
 */
export async function getAllowedPageKeysForRoleId(roleId: number): Promise<AdminPageKey[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: roleRow, error: roleErr } = await supabase
    .from("roles")
    .select("is_full_access")
    .eq("role_id", roleId)
    .maybeSingle();
  if (roleErr) {
    logSupabaseError("getAllowedPageKeysForRoleId: roles", roleErr);
  } else if (roleRow && (roleRow as { is_full_access?: boolean }).is_full_access) {
    return ALL;
  } else if (roleRow) {
    const { data: pageRows, error } = await supabase
      .from("role_pages")
      .select("page_key")
      .eq("role_id", roleId);
    if (error) {
      logSupabaseError("getAllowedPageKeysForRoleId: role_pages", error);
      return ALL;
    }
    if (pageRows?.length) {
      const out: AdminPageKey[] = [];
      for (const p of pageRows) {
        const k = (p as { page_key: string }).page_key;
        if (isAdminPageKey(k)) out.push(k);
      }
      return out.length > 0 ? out : [];
    }
    return ALL;
  }

  const { data: legRole, error: legErr } = await supabase
    .from("admin_roles")
    .select("is_full_access")
    .eq("id", roleId)
    .maybeSingle();
  if (legErr) {
    logSupabaseError("getAllowedPageKeysForRoleId: admin_roles (legacy)", legErr);
    return ALL;
  }
  if (legRole && (legRole as { is_full_access?: boolean }).is_full_access) {
    return ALL;
  }
  const { data: pres, error: presErr } = await supabase
    .from("admin_role_presets")
    .select("allowed_page_keys")
    .eq("role_id", roleId)
    .maybeSingle();
  if (presErr) {
    logSupabaseError("getAllowedPageKeysForRoleId: admin_role_presets (legacy)", presErr);
    return ALL;
  }
  const raw = (pres as { allowed_page_keys?: string[] | null } | null)?.allowed_page_keys;
  if (!raw || !Array.isArray(raw)) {
    return ALL;
  }
  if (raw.length === 0) {
    return [];
  }
  const out: AdminPageKey[] = [];
  for (const k of raw) {
    if (isAdminPageKey(k)) out.push(k);
  }
  return out.length > 0 ? out : [];
}

export async function getNavAllowedPageKeysForSession(
  session: AdminSessionPayload
): Promise<AdminPageKey[]> {
  if (session.is_full_access) {
    return ALL;
  }
  const allowed = await getAllowedPageKeysForRoleId(session.admin_role_id);
  const all = allAdminPageKeys();
  return all.filter((k) => allowed.includes(k));
}

