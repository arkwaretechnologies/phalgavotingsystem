import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export const runtime = "nodejs";

function tsSafe(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}`;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type VoterRow = {
  id: string;
  full_name: string;
  position: string | null;
  lgu: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
};

type SubmittedBallotRow = { voter_id: string | null };

function renderHtml(rows: VoterRow[], generatedAtIso: string) {
  const title = "Inactive Voters";
  const generatedAt = new Date(generatedAtIso).toLocaleString();
  const body = rows
    .map((r, idx) => {
      const lguProv = `${r.lgu ?? ""}${r.province ? ` / ${r.province}` : ""}`.trim();
      return `<tr>
        <td class="num">${idx + 1}</td>
        <td>${escapeHtml(r.full_name)}</td>
        <td>${escapeHtml(r.position ?? "")}</td>
        <td>${escapeHtml(lguProv)}</td>
        <td>${escapeHtml(r.email ?? "")}</td>
        <td>${escapeHtml(r.phone ?? "")}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 6px; }
      .meta { font-size: 12px; color: #555; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
      th { background: #f5f5f5; text-align: left; }
      td.num, th.num { text-align: right; white-space: nowrap; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p class="meta">Generated at ${escapeHtml(generatedAt)}. Rows: ${rows.length}.</p>
    <table>
      <thead>
        <tr>
          <th class="num">No.</th>
          <th>Name</th>
          <th>Position</th>
          <th>LGU / Province</th>
          <th>Email</th>
          <th>Phone</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceRoleClient();
  const generatedAtIso = new Date().toISOString();

  let rows: VoterRow[] = [];
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const submitted = await fetchAllRows<SubmittedBallotRow>(
      (from, to) =>
        supabase
          .from("ballots")
          .select("voter_id")
          .eq("is_submitted", true)
          .order("created_at", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    );
    const submittedVoterIds = new Set(
      submitted
        .map((r) => (r.voter_id ? String(r.voter_id) : ""))
        .filter((x) => x.length > 0),
    );

    const voters = await fetchAllRows<VoterRow>(
      (from, to) =>
        supabase
          .from("voters")
          .select("id, full_name, position, lgu, province, email, phone")
          .order("full_name", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    );

    rows = voters.filter((v) => !submittedVoterIds.has(v.id));

    const html = renderHtml(rows, generatedAtIso);
    const filename = `Inactive_Voters_${tsSafe(new Date())}.pdf`;

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("inactive voters pdf generation failed", e);
    return NextResponse.json({ error: "Unable to generate PDF." }, { status: 500 });
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}

