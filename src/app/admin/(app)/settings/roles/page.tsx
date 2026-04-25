import { RolePresetsForm } from "./role-presets-form";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { isSystemSuperSession, listAdminRolesWithPresets } from "@/lib/admin/admin-roles";
import { getAdminSession } from "@/lib/admin/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminSettingsRolesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!isSystemSuperSession(session)) {
    redirect("/admin/settings/conference?error=" + encodeURIComponent("You do not have access to that page."));
  }

  const { roles, loadDegraded } = await listAdminRolesWithPresets();

  return (
    <div className="space-y-4">
      <UrlToasts clearParams={["error", "toast", "message"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Role management</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Add or remove custom roles and set which top-level admin areas each role can open. The{" "}
          <span className="font-medium">Super admin</span> role always has full access and is
          required to open this page and{" "}
          <Link href="/admin/settings/users" className="text-neutral-900 underline">
            Users
          </Link>
          . Assign users to roles on the Users page. Saving applies on the next navigation (no
          re-login).
        </p>
        <RolePresetsForm roles={roles} loadDegraded={loadDegraded} />
      </div>
    </div>
  );
}
