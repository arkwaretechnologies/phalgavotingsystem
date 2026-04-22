import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import AdminShell from "../_components/AdminShell";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return <AdminShell>{children}</AdminShell>;
}

