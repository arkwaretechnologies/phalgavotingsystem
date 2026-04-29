import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";
import {
  buildCanvassReportModel,
  getCanvassReportHeaderDataUrl,
  renderCanvassReportHtml,
} from "@/lib/admin/canvass-report";
import { getAppSettingsStatus } from "@/lib/admin/app-settings-status";
import { hasFinalTallyGrant } from "@/lib/admin/final-tally-grant";

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

  const status = await getAppSettingsStatus();
  const isClosed = status === "closed";
  const unlocked = await hasFinalTallyGrant();
  if (!isClosed && !unlocked) {
    return NextResponse.json({ error: "Canvass report is locked." }, { status: 403 });
  }

  const payload = await getAdminResultsPayload();
  const model = buildCanvassReportModel(payload);
  if (!model) {
    return NextResponse.json({ error: "No active conference set." }, { status: 400 });
  }

  const headerDataUrl = await getCanvassReportHeaderDataUrl();
  const html = renderCanvassReportHtml(model, { headerDataUrl });
  const now = new Date();
  const filename = `Canvass_${fileSafe(model.confcode)}_${tsSafe(now)}.pdf`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const footerTemplate = `
      <div style="width:100%; font-size:10px; color:#666; padding:0 14mm; display:flex; justify-content:space-between;">
        <div>${model.conferenceName ? `${model.confcode} · ${model.conferenceName}` : model.confcode}</div>
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
    console.error("canvass pdf generation failed", e);
    return NextResponse.json({ error: "Unable to generate PDF." }, { status: 500 });
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}

