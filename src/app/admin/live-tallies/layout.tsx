import { assertAdminPathAccessForSession, getPathnameFromHeaders } from "@/lib/admin/path-access";
import { getAdminSession } from "@/lib/admin/session";
import { redirect } from "next/navigation";

export default async function LiveTalliesLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const path = await getPathnameFromHeaders();
  if (path) {
    await assertAdminPathAccessForSession(session, path);
  }

  return (
    <div className="live-tallies-shell flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-[var(--ph-flag-blue-deep)] to-slate-950 text-slate-50">
      <div aria-hidden className="ph-flag-strip-top--thin ph-flag-strip-top" />
      <div className="min-h-0 flex-1">{children}</div>
      <div aria-hidden className="ph-flag-strip-bottom--thin ph-flag-strip-bottom" />
    </div>
  );
}
