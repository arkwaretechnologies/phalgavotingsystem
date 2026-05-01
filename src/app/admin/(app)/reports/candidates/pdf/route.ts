import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

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

type CandidateRow = {
  id: string;
  full_name: string;
};

function renderHtml(rows: CandidateRow[], generatedAtIso: string) {
  const title = "Candidates";
  const generatedAt = new Date(generatedAtIso).toLocaleString();
  const body = rows
    .map((r, idx) => {
      return `<tr>
        <td class="num">${idx + 1}</td>
        <td>${escapeHtml(r.full_name)}</td>
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
          <th>Candidate</th>
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

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const primary = await supabase
      .from("candidates")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    let sorted: CandidateRow[] = [];
    if (primary.error) {
      const code = (primary.error as { code?: string } | null)?.code ?? "";
      if (code === "42703") {
        const fallback = await supabase
          .from("candidates")
          .select("id, display_name")
          .order("display_name", { ascending: true });
        if (fallback.error) throw fallback.error;
        sorted = ((fallback.data ?? []) as Array<{ id: string; display_name: string }>).map(
          (r) => ({ id: r.id, full_name: r.display_name }),
        );
      } else {
        throw primary.error;
      }
    } else {
      sorted = (primary.data ?? []) as CandidateRow[];
    }

    const html = renderHtml(sorted, generatedAtIso);
    const filename = `Candidates_${tsSafe(new Date())}.pdf`;

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
    console.error("candidates pdf generation failed", e);
    const { message } = toPublicMessage(e, "Unable to generate PDF.");
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}

