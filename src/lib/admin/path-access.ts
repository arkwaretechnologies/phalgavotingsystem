import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSystemSuperSession } from "./admin-roles";
import type { AdminPageKey } from "./admin-page-keys";
import { getAllowedPageKeysForRoleId } from "./role-presets";
import type { AdminSessionPayload } from "./session";

const PATH_HEADER = "x-phalga-path";

/**
 * Resolves a pathname to a controllable page key, or `null` if unknown (deny).
 * User/role management routes use `isSystemSuperSession`, not presets.
 */
export function pathnameToPageKey(pathname: string): AdminPageKey | "settings_users" | "settings_roles" | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/admin") return "dashboard";
  if (p.startsWith("/admin/check-in")) return "check_in";
  if (p.startsWith("/admin/queueing")) return "queueing";
  if (p.startsWith("/admin/voters")) return "voters";
  if (p.startsWith("/admin/candidates")) return "candidates";
  if (p.startsWith("/admin/ballots")) return "ballots";
  if (p.startsWith("/admin/tablets")) return "tablets";
  if (p.startsWith("/admin/results")) return "results";
  if (p.startsWith("/admin/canvass")) return "canvass";
  if (p.startsWith("/admin/settings/users")) return "settings_users";
  if (p.startsWith("/admin/settings/roles")) return "settings_roles";
  if (p.startsWith("/admin/settings")) return "settings";
  if (p.startsWith("/admin/live-tallies")) return "live_tallies";
  return null;
}

export async function getPathnameFromHeaders(): Promise<string | null> {
  const h = await headers();
  return h.get(PATH_HEADER) ?? h.get("next-url");
}

/**
 * `is_system` super (slug `super_admin`) is required for user/role settings.
 * `is_full_access` grants every top-level page; other roles use `role_pages`.
 */
export async function assertAdminPathAccessForSession(
  session: AdminSessionPayload,
  pathname: string
): Promise<void> {
  const key = pathnameToPageKey(pathname);
  if (key === "settings_users" || key === "settings_roles") {
    if (!isSystemSuperSession(session)) {
      redirect("/admin/settings/conference?error=" + encodeURIComponent("You do not have access to that page."));
    }
    return;
  }
  if (key === null) {
    redirect("/admin?error=" + encodeURIComponent("You do not have access to that page."));
    return;
  }
  if (session.is_full_access) return;

  const allowed = await getAllowedPageKeysForRoleId(session.admin_role_id);
  if (!allowed.includes(key)) {
    redirect("/admin?error=" + encodeURIComponent("You do not have access to that page."));
  }
}
