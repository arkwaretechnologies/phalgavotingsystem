import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import type { AdminPageKey } from "./admin-page-keys";
import { allAdminPageKeys, isAdminPageKey } from "./admin-page-keys";
import type { AdminSessionPayload } from "./session";

const ALL = allAdminPageKeys();

export type AdminUserRole = AdminSessionPayload["role"];

/**
 * Fetches allowed page keys for a role. On missing row, returns all keys (fail-open).
 * `getAllowedPageKeysForRole` is used for nav + access; DB stores arrays for each role.
 */
export async function getAllowedPageKeysForRole(role: AdminUserRole): Promise<AdminPageKey[]> {
  if (role === "super_admin") {
    return ALL;
  }
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_role_presets")
    .select("allowed_page_keys")
    .eq("role", role)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("getAllowedPageKeysForRole failed", error);
    const { message } = toPublicMessage(error, "Unable to load role permissions.");
    throw new Error(message);
  }
  const raw = (data as { allowed_page_keys?: string[] | null } | null)?.allowed_page_keys;
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

export async function getAllRolePresetsMap(): Promise<Record<AdminUserRole, AdminPageKey[]>> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_role_presets")
    .select("role, allowed_page_keys")
    .in("role", ["super_admin", "admin", "personnel"]);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("getAllRolePresetsMap failed", error);
    const { message } = toPublicMessage(error, "Unable to load role presets.");
    throw new Error(message);
  }

  const base: Record<AdminUserRole, AdminPageKey[]> = {
    super_admin: ALL,
    admin: ALL,
    personnel: ALL,
  };

  for (const row of data ?? []) {
    const r = (row as { role?: string; allowed_page_keys?: string[] | null }).role;
    const keys = (row as { allowed_page_keys?: string[] | null }).allowed_page_keys;
    if (r === "super_admin" || r === "admin" || r === "personnel") {
      if (keys && Array.isArray(keys) && keys.length > 0) {
        const parsed = keys.filter((k): k is AdminPageKey => isAdminPageKey(k));
        base[r] = parsed.length > 0 ? parsed : ALL;
      }
    }
  }
  return base;
}
