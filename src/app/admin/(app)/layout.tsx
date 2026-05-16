import { redirect } from "next/navigation";
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

  if (!path) {
    // Fail closed: without a resolved pathname we cannot enforce RBAC, so we
    // refuse to render the shell rather than serve a privileged page based on
    // session alone. This also catches setups where the middleware that
    // injects `x-phalga-path` isn't running.
    redirect("/admin?error=" + encodeURIComponent("Unable to verify page access. Please reload."));
  }

  await assertAdminPathAccessForSession(session, path);

  const allowedPageKeys = await getNavAllowedPageKeysForSession(session);

  return (
    <AdminShell allowedPageKeys={allowedPageKeys} isSystemSuper={isSystemSuperSession(session)}>
      {children}
    </AdminShell>
  );
}

