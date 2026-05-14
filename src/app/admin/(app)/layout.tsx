import { isSystemSuperSession } from "@/lib/admin/admin-roles";
import { getNavAllowedPageKeysForSession } from "@/lib/admin/role-presets";
import {
  assertAdminPathAccessForSession,
  getPathnameFromHeaders,
} from "@/lib/admin/path-access";
import { requireAdminSession } from "@/lib/admin/session";
import AdminShell from "../_components/AdminShell";

/** Auth + role checks must run every request; never serve a cached shell as logged-in. */
export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();
  const path = await getPathnameFromHeaders();

  if (path) {
    await assertAdminPathAccessForSession(session, path);
  }

  const allowedPageKeys = await getNavAllowedPageKeysForSession(session);

  return (
    <AdminShell allowedPageKeys={allowedPageKeys} isSystemSuper={isSystemSuperSession(session)}>
      {children}
    </AdminShell>
  );
}

