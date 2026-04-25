import { AdminUsersTable } from "../admin-users-table";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { isSystemSuperSession } from "@/lib/admin/admin-roles";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { redirect } from "next/navigation";

type AdminRoleRow = { role_id: number; name: string; slug: string; sort_order: number | null };

export default async function AdminSettingsUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!isSystemSuperSession(session)) {
    redirect("/admin/settings/conference?error=" + encodeURIComponent("You do not have access to that page."));
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("role_id, name, slug, sort_order")
    .order("sort_order", { ascending: true, nullsFirst: false });

  if (rolesError) {
    // eslint-disable-next-line no-console
    console.error("roles list failed", rolesError);
    const { message } = toPublicMessage(rolesError, "Unable to load roles.");
    throw new Error(message);
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, username, full_name, role_id, created_at")
    .order("id", { ascending: true });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("admin_users list failed", error);
    const { message } = toPublicMessage(error, "Unable to load users.");
    throw new Error(message);
  }

  const roleList = (roles ?? []) as AdminRoleRow[];
  const labelById = new Map<number, string>(roleList.map((r) => [r.role_id, r.name]));
  const users = (data ?? []).map((u) => {
    const rid = u.role_id as number | null;
    return {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role_id: rid,
      role_label: rid != null ? (labelById.get(rid) ?? `Role #${rid}`) : "—",
      created_at: u.created_at,
    };
  });

  if (roleList.length === 0) {
    throw new Error("No admin roles are configured. Apply database migrations, then add roles under Role management.");
  }

  const personnel = roleList.find((r) => r.slug === "personnel");
  const defaultAddRoleId = personnel?.role_id ?? roleList[0]!.role_id;

  return (
    <div className="space-y-4">
      <UrlToasts clearParams={["error"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Users</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Manage admin sign-ins stored in <span className="font-mono">admin_users</span>. Passwords
          are stored hashed.
        </p>
        <div className="mt-6">
          <AdminUsersTable
            users={users}
            roleOptions={roleList.map((r) => ({ id: r.role_id, label: r.name, slug: r.slug }))}
            defaultAddRoleId={defaultAddRoleId}
            currentUserId={session.admin_user_id}
          />
        </div>
      </div>
    </div>
  );
}
