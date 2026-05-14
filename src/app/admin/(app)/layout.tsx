import { isSystemSuperSession } from "@/lib/admin/admin-roles";
import { getNavAllowedPageKeysForSession } from "@/lib/admin/role-presets";
import {
  assertAdminPathAccessForSession,
  getPathnameFromHeaders,
} from "@/lib/admin/path-access";
import { getAdminSession } from "@/lib/admin/session";
import { redirect } from "next/navigation";
import AdminShell from "../_components/AdminShell";

/** Auth + role checks must run every request; never serve a cached shell as logged-in. */
export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const path = await getPathnameFromHeaders();
  if (!session) {
    // eslint-disable-next-line no-console
    console.warn(`[admin-layout] redirecting to login (path=${path ?? "?"})`);
    redirect("/admin/login");
  }

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

