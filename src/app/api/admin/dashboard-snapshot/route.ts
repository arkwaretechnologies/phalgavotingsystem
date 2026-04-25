import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { getDashboardSnapshot } from "@/lib/admin/dashboard-snapshot";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(snapshot);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to load dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
