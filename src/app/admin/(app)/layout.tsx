import { redirect } from "next/navigation";
import {
  assertAdminPathAccessForSession,
  getNavAllowedPageKeysForSession,
  getPathnameFromHeaders,
} from "@/lib/admin/path-access";
import { getAdminSession } from "@/lib/admin/session";
import AdminShell from "../_components/AdminShell";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const path = await getPathnameFromHeaders();
  if (path) {
    await assertAdminPathAccessForSession(session, path);
  }

  const allowedPageKeys = await getNavAllowedPageKeysForSession(session);

  return (
    <AdminShell allowedPageKeys={allowedPageKeys} isSuperAdmin={session.role === "super_admin"}>
      {children}
    </AdminShell>
  );
}

