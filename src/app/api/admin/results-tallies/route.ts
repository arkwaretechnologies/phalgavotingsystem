import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getAdminResultsPayload();
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to load results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
