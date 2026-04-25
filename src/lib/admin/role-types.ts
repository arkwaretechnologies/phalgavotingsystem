import type { AdminPageKey } from "./admin-page-keys";

/** Reserved slug: full access + can manage users and custom roles. */
export const SYSTEM_SUPER_SLUG = "super_admin" as const;

export type AdminRoleWithPreset = {
  id: number;
  slug: string;
  label: string;
  is_system: boolean;
  is_full_access: boolean;
  sort_order: number;
  created_at: string | null;
  pageKeys: AdminPageKey[];
  updatedAt: string | null;
};

/** @deprecated legacy fixed role keys only — prefer dynamic `roles.slug` */
export type AdminUserRole = "super_admin" | "admin" | "personnel";
