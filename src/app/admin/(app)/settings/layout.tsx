import { getAdminSession } from "@/lib/admin/session";
import { redirect } from "next/navigation";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Conference, users, and role permissions.</p>
      </div>
      {children}
    </div>
  );
}
