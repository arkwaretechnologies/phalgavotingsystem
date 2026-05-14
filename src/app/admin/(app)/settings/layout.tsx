import { requireAdminSession } from "@/lib/admin/session";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();

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
