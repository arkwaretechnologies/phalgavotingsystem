import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logSupabaseError } from "./admin-roles-helpers";

/**
 * New schema: `public.roles` (PK `role_id`). Legacy: `public.admin_roles` (PK `id`) before
 * `20260427200000_roles_and_role_pages.sql` is applied. Login and permissions must work in
 * both states.
 */
export async function fetchAdminRoleByUserRoleId(
  roleId: number,
): Promise<{ slug: string; is_full_access: boolean } | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: r1, error: e1 } = await supabase
    .from("roles")
    .select("slug, is_full_access")
    .eq("role_id", roleId)
    .maybeSingle();
  if (e1) {
    logSupabaseError("fetchAdminRole: roles", e1);
  } else if (r1) {
    return { slug: String((r1 as { slug: string }).slug), is_full_access: Boolean((r1 as { is_full_access: boolean }).is_full_access) };
  }

  const { data: r2, error: e2 } = await supabase
    .from("admin_roles")
    .select("slug, is_full_access")
    .eq("id", roleId)
    .maybeSingle();
  if (e2) {
    logSupabaseError("fetchAdminRole: admin_roles (legacy)", e2);
    return null;
  }
  if (r2) {
    return { slug: String((r2 as { slug: string }).slug), is_full_access: Boolean((r2 as { is_full_access: boolean }).is_full_access) };
  }
  return null;
}
