import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminPageKey } from "./admin-page-keys";
import { allAdminPageKeys } from "./admin-page-keys";
import { getAllowedPageKeysForRole } from "./role-presets";
import type { AdminSessionPayload } from "./session";

const PATH_HEADER = "x-phalga-path";

/**
 * Resolves a pathname to a controllable page key, or `null` if unknown (deny).
 * User management routes use separate super_admin checks, not the preset list.
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
 * `super_admin` always has every page. `settings_users` and `settings_roles` require `super_admin`.
 * Other roles: compare against `admin_role_presets`.
 */
export async function assertAdminPathAccessForSession(
  session: AdminSessionPayload,
  pathname: string
): Promise<void> {
  const key = pathnameToPageKey(pathname);
  if (key === "settings_users" || key === "settings_roles") {
    if (session.role !== "super_admin") {
      redirect("/admin/settings/conference?error=" + encodeURIComponent("You do not have access to that page."));
    }
    return;
  }
  if (key === null) {
    redirect("/admin?error=" + encodeURIComponent("You do not have access to that page."));
    return;
  }
  if (session.role === "super_admin") return;

  const allowed = await getAllowedPageKeysForRole(session.role);
  if (!allowed.includes(key)) {
    redirect("/admin?error=" + encodeURIComponent("You do not have access to that page."));
  }
}

/**
 * For sidebar: allowed nav keys (subset of `AdminPageKey`, always full for super_admin).
 */
export async function getNavAllowedPageKeysForSession(session: AdminSessionPayload): Promise<AdminPageKey[]> {
  if (session.role === "super_admin") {
    return allAdminPageKeys();
  }
  const allowed = await getAllowedPageKeysForRole(session.role);
  const all = allAdminPageKeys();
  return all.filter((k) => allowed.includes(k));
}
