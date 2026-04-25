import { saveAllRolePresets } from "@/app/admin/settings/role-preset-actions";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { ADMIN_PAGE_KEY_ORDER, adminPageKeyLabel } from "@/lib/admin/admin-page-keys";
import { getAllRolePresetsMap } from "@/lib/admin/role-presets";
import { getAdminSession } from "@/lib/admin/session";
import { redirect } from "next/navigation";

export default async function AdminSettingsRolesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "super_admin") {
    redirect("/admin/settings/conference?error=" + encodeURIComponent("You do not have access to that page."));
  }

  const presets = await getAllRolePresetsMap();
  const asSet = (keys: string[]) => new Set(keys);

  return (
    <div className="space-y-4">
      <UrlToasts clearParams={["error"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Role management</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Choose which top-level admin pages each role can open. User management and role
          management remain limited to super admins. Changes apply on the next request (no
          re-login required).
        </p>

        <form action={saveAllRolePresets} className="mt-6 space-y-8">
          <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4">
            <div className="text-sm font-semibold text-neutral-900">Super admin</div>
            <p className="mt-1 text-sm text-neutral-600">Always has access to all pages. Stored as full access for reference.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {ADMIN_PAGE_KEY_ORDER.map((k) => (
                <li
                  key={k}
                  className="rounded-md border border-white/60 bg-white px-2 py-1 text-xs font-medium text-neutral-700"
                >
                  {adminPageKeyLabel(k)}
                </li>
              ))}
            </ul>
          </div>

          {(["admin", "personnel"] as const).map((role) => {
            const allowed = asSet(presets[role]);
            return (
              <div key={role} className="rounded-xl border border-neutral-200/90 p-4">
                <div className="text-sm font-semibold capitalize text-neutral-900">{role.replace("_", " ")}</div>
                <p className="mt-1 text-sm text-neutral-600">At least one page must stay selected.</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ADMIN_PAGE_KEY_ORDER.map((k) => (
                    <li key={k}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                        <input
                          type="checkbox"
                          name={`${role}__${k}`}
                          value="1"
                          defaultChecked={allowed.has(k)}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                        <span>{adminPageKeyLabel(k)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div>
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Save role permissions
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
