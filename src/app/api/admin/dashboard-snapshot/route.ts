import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { getDashboardSnapshot } from "@/lib/admin/dashboard-snapshot";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await sessionHasAdminPageAccess(session, "dashboard"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(snapshot);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("dashboard snapshot load failed", e);
    return NextResponse.json({ error: "Unable to load dashboard." }, { status: 500 });
  }
}
