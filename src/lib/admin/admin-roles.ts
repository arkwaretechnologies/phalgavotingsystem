import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { AdminPageKey } from "./admin-page-keys";
import { allAdminPageKeys, isAdminPageKey } from "./admin-page-keys";
import type { AdminSessionPayload } from "./session";
import type { AdminRoleWithPreset } from "./role-types";
import { SYSTEM_SUPER_SLUG } from "./role-types";

const ALL = allAdminPageKeys();

export { SYSTEM_SUPER_SLUG } from "./role-types";

export function isSystemSuperSession(session: AdminSessionPayload | null): boolean {
  if (!session) return false;
  return session.role_slug === SYSTEM_SUPER_SLUG;
}

export async function getSuperAdminRoleId(): Promise<number | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: a, error: e1 } = await supabase
    .from("roles")
    .select("role_id")
    .eq("slug", SYSTEM_SUPER_SLUG)
    .maybeSingle();
  if (!e1 && a) {
    return Number((a as { role_id: unknown }).role_id) || null;
  }
  const { data: b, error: e2 } = await supabase
    .from("admin_roles")
    .select("id")
    .eq("slug", SYSTEM_SUPER_SLUG)
    .maybeSingle();
  if (e2 || !b) return null;
  return Number((b as { id: unknown }).id) || null;
}

/**
 * All roles with preset data for the management UI.
 */
export async function listAdminRolesWithPresets(): Promise<{
  roles: AdminRoleWithPreset[];
  loadDegraded: boolean;
}> {
  const supabase = createSupabaseServiceRoleClient();
  const r1 = await supabase
    .from("roles")
    .select("role_id, name, slug, is_system, is_full_access, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("role_id", { ascending: true });
  if (r1.error) {
    // eslint-disable-next-line no-console
    console.error("listAdminRolesWithPresets: roles", r1.error);
  }
  const p1 = await supabase.from("role_pages").select("role_id, page_key");
  if (p1.error) {
    // eslint-disable-next-line no-console
    console.error("listAdminRolesWithPresets: role_pages", p1.error);
  }
  const roleRows = (r1.data as unknown[] | null) ?? null;
  const pageRows = (p1.data as unknown[] | null) ?? null;

  if (!roleRows?.length) {
    const r2 = await supabase
      .from("admin_roles")
      .select("id, slug, label, is_system, is_full_access, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (r2.error) {
      // eslint-disable-next-line no-console
      console.error("listAdminRolesWithPresets: admin_roles (legacy)", r2.error);
      return { roles: [], loadDegraded: true };
    }
    if (!(r2.data as unknown[] | null)?.length) {
      return { roles: [], loadDegraded: true };
    }
    const p2 = await supabase
      .from("admin_role_presets")
      .select("role_id, allowed_page_keys, updated_at");
    if (p2.error) {
      // eslint-disable-next-line no-console
      console.error("listAdminRolesWithPresets: admin_role_presets (legacy)", p2.error);
    }
    const keysByRole2 = new Map<number, { keys: string[]; updated: string | null }>();
    for (const p of p2.data ?? []) {
      const row = p as { role_id: number; allowed_page_keys: string[] | null; updated_at: string | null };
      keysByRole2.set(row.role_id, { keys: row.allowed_page_keys ?? [], updated: row.updated_at });
    }
    const altRoles: AdminRoleWithPreset[] = (r2.data ?? []).map((row) => {
      const r = row as {
        id: number;
        slug: string;
        label: string;
        is_system: boolean;
        is_full_access: boolean;
        sort_order: number;
        created_at: string | null;
      };
      const pr = keysByRole2.get(r.id);
      const rawKeys = pr?.keys;
      const pageKeys: AdminPageKey[] = [];
      if (rawKeys) {
        for (const k of rawKeys) {
          if (isAdminPageKey(k)) pageKeys.push(k);
        }
      }
      return {
        id: r.id,
        slug: r.slug,
        label: r.label,
        is_system: r.is_system,
        is_full_access: r.is_full_access,
        sort_order: r.sort_order,
        created_at: r.created_at,
        pageKeys: pageKeys.length > 0 ? pageKeys : ALL,
        updatedAt: pr?.updated ?? null,
      };
    });
    return { roles: altRoles, loadDegraded: false };
  }

  const keysByRole = new Map<number, string[]>();
  for (const p of pageRows ?? []) {
    const row = p as { role_id: number; page_key: string };
    if (!keysByRole.has(row.role_id)) keysByRole.set(row.role_id, []);
    keysByRole.get(row.role_id)!.push(row.page_key);
  }

  const roles: AdminRoleWithPreset[] = (roleRows ?? []).map((row) => {
    const r = row as {
      role_id: number;
      slug: string;
      name: string;
      is_system: boolean;
      is_full_access: boolean;
      sort_order: number;
      created_at: string | null;
      updated_at: string | null;
    };
    const rawKeys = keysByRole.get(r.role_id);
    const pageKeys: AdminPageKey[] = [];
    if (rawKeys) {
      for (const k of rawKeys) {
        if (isAdminPageKey(k)) pageKeys.push(k);
      }
    }
    return {
      id: r.role_id,
      slug: r.slug,
      label: r.name,
      is_system: r.is_system,
      is_full_access: r.is_full_access,
      sort_order: r.sort_order,
      created_at: r.created_at,
      pageKeys: pageKeys.length > 0 ? pageKeys : ALL,
      updatedAt: r.updated_at,
    };
  });

  return { roles, loadDegraded: false };
}
