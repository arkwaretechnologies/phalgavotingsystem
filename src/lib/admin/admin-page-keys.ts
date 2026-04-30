/**
 * Page keys for admin area access control. Must match `role_pages.page_key` values
 * and the pathname mapping in `path-access.ts`.
 */
export const ADMIN_PAGE_KEY_ORDER = [
  "dashboard",
  "check_in",
  "queueing",
  "voters",
  "candidates",
  "tablets",
  "live_tallies",
  "canvass",
  "settings",
] as const;

export type AdminPageKey = (typeof ADMIN_PAGE_KEY_ORDER)[number];

const LABEL: Record<AdminPageKey, string> = {
  dashboard: "Dashboard",
  check_in: "Check-in",
  queueing: "Queueing",
  voters: "Voters",
  candidates: "Candidates",
  tablets: "Tablets",
  live_tallies: "Live tallies",
  canvass: "Canvass (Results · Ballots · Report)",
  settings: "Settings (conference)",
};

export function isAdminPageKey(s: string): s is AdminPageKey {
  return (ADMIN_PAGE_KEY_ORDER as readonly string[]).includes(s);
}

export function adminPageKeyLabel(key: AdminPageKey): string {
  return LABEL[key];
}

export function allAdminPageKeys(): AdminPageKey[] {
  return [...ADMIN_PAGE_KEY_ORDER];
}

/** Keeps canonical order; unknown keys dropped. */
export function normalizePageKeysFromForm(keys: string[]): AdminPageKey[] {
  const set = new Set<AdminPageKey>();
  for (const k of keys) {
    if (isAdminPageKey(k)) set.add(k);
  }
  return ADMIN_PAGE_KEY_ORDER.filter((k) => set.has(k));
}

/** Nav href per key (for sidebar; matches `AdminShell` NAV_ITEMS). */
export const ADMIN_PAGE_HREF: Record<AdminPageKey, string> = {
  dashboard: "/admin",
  check_in: "/admin/check-in",
  queueing: "/admin/queueing",
  voters: "/admin/voters",
  candidates: "/admin/candidates",
  tablets: "/admin/tablets",
  live_tallies: "/admin/live-tallies",
  canvass: "/admin/canvass",
  settings: "/admin/settings/conference",
};
