import { AdminUsersTable } from "../admin-users-table";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { redirect } from "next/navigation";

export default async function AdminSettingsUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "super_admin") {
    redirect("/admin/settings/conference?error=" + encodeURIComponent("You do not have access to that page."));
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, username, full_name, role, created_at")
    .order("id", { ascending: true });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("admin_users list failed", error);
    const { message } = toPublicMessage(error, "Unable to load users.");
    throw new Error(message);
  }

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
          <AdminUsersTable users={data ?? []} currentUserId={session.admin_user_id} />
        </div>
      </div>
    </div>
  );
}
