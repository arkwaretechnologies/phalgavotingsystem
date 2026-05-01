import { redirect } from "next/navigation";
import {
  assertAdminPathAccessForSession,
  getPathnameFromHeaders,
} from "@/lib/admin/path-access";
import { getAdminSession } from "@/lib/admin/session";

export default async function CandidateProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const path = await getPathnameFromHeaders();
  if (path) {
    await assertAdminPathAccessForSession(session, path);
  }

  return <div className="min-h-dvh">{children}</div>;
}
