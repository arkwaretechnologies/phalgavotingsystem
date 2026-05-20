import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { getCanvassReportHeaderDataUrl } from "@/lib/admin/canvass-report";
import { loadReportsOverviewModel, renderReportsOverviewHtml } from "@/lib/admin/reports-overview";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await sessionHasAdminPageAccess(session, "reports"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const model = await loadReportsOverviewModel();
  const headerDataUrl = await getCanvassReportHeaderDataUrl();
  const html = renderReportsOverviewHtml(model, { headerDataUrl, includePrintButton: true });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
