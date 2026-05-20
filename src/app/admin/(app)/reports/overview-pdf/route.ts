import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { launchPdfBrowser } from "@/lib/pdf/puppeteer-launch";
import { getCanvassReportHeaderDataUrl } from "@/lib/admin/canvass-report";
import { loadReportsOverviewModel, renderReportsOverviewHtml } from "@/lib/admin/reports-overview";

export const runtime = "nodejs";

function fileSafe(s: string) {
  return s.replaceAll(/[^a-zA-Z0-9_-]+/g, "_");
}

function tsSafe(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}`;
}

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
  const html = renderReportsOverviewHtml(model, { headerDataUrl });

  const now = new Date();
  const confPart = model.confcode ? fileSafe(model.confcode) : "Overview";
  const filename = `Reports_Overview_${confPart}_${tsSafe(now)}.pdf`;

  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;
  try {
    browser = await launchPdfBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const footerLeft =
      model.confcode && model.conferenceName
        ? `${model.confcode} · ${model.conferenceName}`
        : model.confcode ?? "—";

    const footerTemplate = `
      <div style="width:100%; font-size:10px; color:#666; padding:0 14mm; display:flex; justify-content:space-between;">
        <div>${footerLeft}</div>
        <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
      </div>
    `;

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate,
      margin: { top: "14mm", bottom: "20mm", left: "14mm", right: "14mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("reports overview pdf generation failed", e);
    return NextResponse.json({ error: "Unable to generate PDF." }, { status: 500 });
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}
