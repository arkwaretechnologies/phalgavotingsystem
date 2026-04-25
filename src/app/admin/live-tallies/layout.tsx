import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";

export default async function LiveTalliesLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="live-tallies-shell flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
