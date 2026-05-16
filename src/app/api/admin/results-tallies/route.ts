import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await sessionHasAdminPageAccess(session, "canvass"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getAdminResultsPayload();
    return NextResponse.json(payload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("results tallies load failed", e);
    return NextResponse.json({ error: "Unable to load results." }, { status: 500 });
  }
}
