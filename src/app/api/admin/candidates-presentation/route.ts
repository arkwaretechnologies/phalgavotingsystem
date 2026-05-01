import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

export const runtime = "nodejs";

function tsSafe(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}`;
}

function fileSafe(s: string) {
  return s.replaceAll(/[^a-zA-Z0-9_-]+/g, "_");
}

function escapeHtml(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type GeoGroupLite = { id: number; code: string; name: string };

type Candidate = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean | null;
  confcode: string;
  present_position: string | null;
  lgu_address: string | null;
  highest_educational_attainment: string | null;
  geo_group?: GeoGroupLite | null;
};

type PrevCurrLine = {
  id: string;
  linenum: number;
  position: string | null;
  period_covered: string | null;
};

let cachedBgDataUrl: string | null | undefined;
let cachedLogoDataUrl: string | null | undefined;

async function readPublicAsDataUrl(
  filename: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const fp = path.join(process.cwd(), "public", filename);
    const bytes = await readFile(fp);
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

async function getBgDataUrl() {
  if (cachedBgDataUrl !== undefined) return cachedBgDataUrl;
  cachedBgDataUrl = await readPublicAsDataUrl("candidates-bg.png", "image/png");
  return cachedBgDataUrl;
}

async function getLogoDataUrl() {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  cachedLogoDataUrl = await readPublicAsDataUrl("logo.png", "image/png");
  return cachedLogoDataUrl;
}

const PHOTO_FETCH_TIMEOUT_MS = 8_000;
const PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB sanity cap per image

/** Download a remote image and convert it to a data: URL.
 *  Returns `null` on any failure (timeout, non-image, oversized, etc.) so the PDF
 *  can fall through to a "no photo" placeholder instead of hanging puppeteer.
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  // Already inlined.
  if (url.startsWith("data:")) return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;

    const lenHeader = res.headers.get("content-length");
    const declaredLen = lenHeader ? Number(lenHeader) : NaN;
    if (Number.isFinite(declaredLen) && declaredLen > PHOTO_MAX_BYTES) return null;

    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > PHOTO_MAX_BYTES) return null;

    const mime =
      contentType && contentType.startsWith("image/")
        ? contentType
        : (() => {
            const lower = url.toLowerCase();
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".gif")) return "image/gif";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            return "image/jpeg";
          })();

    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function renderPositionLine(line: PrevCurrLine) {
  const pos = (line.position ?? "").trim();
  const per = (line.period_covered ?? "").trim();
  if (pos && per) {
    return `<span class="pos-name">${escapeHtml(pos)}</span> <span class="pos-period">(${escapeHtml(per)})</span>`;
  }
  if (pos) return `<span class="pos-name">${escapeHtml(pos)}</span>`;
  if (per) return `<span class="pos-period">${escapeHtml(per)}</span>`;
  return "";
}

function renderBullets(lines: PrevCurrLine[]) {
  if (!lines.length) {
    return `<p class="empty">No records on record.</p>`;
  }
  return `<ul class="bullets">${lines
    .map((l) => `<li><span class="dot"></span><span>${renderPositionLine(l)}</span></li>`)
    .join("")}</ul>`;
}

function renderCard(label: string, value: string, mono?: boolean) {
  return `<div class="card">
    <div class="card-label">${escapeHtml(label)}</div>
    <div class="card-value ${mono ? "mono" : ""}">${escapeHtml(value)}</div>
  </div>`;
}

function renderCandidatePage(args: {
  candidate: Candidate;
  phalga: PrevCurrLine[];
  provincial: PrevCurrLine[];
  bgDataUrl: string | null;
  logoDataUrl: string | null;
}) {
  const { candidate, phalga, provincial, bgDataUrl, logoDataUrl } = args;
  const geo = candidate.geo_group ?? null;
  const photoSrc = candidate.photo_url ? escapeHtml(candidate.photo_url) : "";
  const hasPhoto = Boolean(candidate.photo_url);
  const bioParas = candidate.bio
    ? String(candidate.bio)
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return `<section class="page">
    <div class="bg" style="${bgDataUrl ? `background-image:url('${bgDataUrl}')` : ""}"></div>
    <div class="overlay"></div>
    ${
      logoDataUrl
        ? `<div class="watermark"><img src="${logoDataUrl}" alt="" /></div>`
        : ""
    }
    <div class="brand">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="PhALGA" />` : ""}
      <span>PhALGA</span>
    </div>

    <div class="content">
      <div class="photo-col">
        <div class="photo-frame">
          ${
            hasPhoto
              ? `<img class="photo" src="${photoSrc}" alt="${escapeHtml(candidate.full_name)} portrait" />`
              : `<div class="photo no-photo">No photo</div>`
          }
        </div>
      </div>

      <div class="details-col">
        <h1 class="name">${escapeHtml(candidate.full_name)}</h1>
        <div class="accent-bar"></div>

        <div class="cards">
          ${
            candidate.present_position
              ? renderCard("Present position", candidate.present_position)
              : ""
          }
          ${candidate.lgu_address ? renderCard("LGU address", candidate.lgu_address) : ""}
          ${
            geo || candidate.confcode
              ? `<div class="card">
                  <div class="card-label">Geo group</div>
                  ${geo ? `<div class="card-value">${escapeHtml(`${geo.code} — ${geo.name}`)}</div>` : ""}
                  ${candidate.confcode ? `<div class="card-sub mono">${escapeHtml(candidate.confcode)}</div>` : ""}
                </div>`
              : ""
          }
        </div>

        <div class="section">
          <span class="section-pill">Education</span>
          ${
            candidate.highest_educational_attainment
              ? `<ul class="bullets">
                  <li><span class="dot"></span><span><strong>Highest educational attainment:</strong> ${escapeHtml(
                    candidate.highest_educational_attainment,
                  )}</span></li>
                </ul>`
              : `<p class="empty">No educational attainment provided.</p>`
          }
        </div>

        <div class="section">
          <span class="section-pill">Previous / Current Positions in PhALGA</span>
          ${renderBullets(phalga)}
        </div>

        <div class="section">
          <span class="section-pill">Previous / Current Positions in Provincial Association</span>
          ${renderBullets(provincial)}
        </div>

        ${
          bioParas.length
            ? `<div class="bio">
                <div class="card-label">Bio</div>
                ${bioParas.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
              </div>`
            : ""
        }
      </div>
    </div>
  </section>`;
}

function renderHtml(args: {
  candidates: Candidate[];
  phalgaById: Record<string, PrevCurrLine[]>;
  provincialById: Record<string, PrevCurrLine[]>;
  bgDataUrl: string | null;
  logoDataUrl: string | null;
  confcode: string;
}) {
  const { candidates, phalgaById, provincialById, bgDataUrl, logoDataUrl, confcode } = args;

  const pages = candidates
    .map((c) =>
      renderCandidatePage({
        candidate: c,
        phalga: phalgaById[c.id] ?? [],
        provincial: provincialById[c.id] ?? [],
        bgDataUrl,
        logoDataUrl,
      }),
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Candidates Presentation — ${escapeHtml(confcode)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@800;900&display=swap"
    />
    <style>
      :root { color-scheme: light; }
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #0a0820; color: #fff; }
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }

      .page {
        position: relative;
        width: 297mm;
        height: 210mm;
        overflow: hidden;
        page-break-after: always;
        background: #0a0820;
      }
      .page:last-child { page-break-after: auto; }

      .bg {
        position: absolute; inset: 0; z-index: 0;
        background-size: cover;
        background-position: center;
      }
      .overlay {
        position: absolute; inset: 0; z-index: 1;
        background: linear-gradient(to bottom, rgba(10,8,32,0.40), rgba(10,8,32,0.55) 50%, rgba(10,8,32,0.85));
      }

      .watermark {
        position: absolute;
        right: -90px; bottom: -90px;
        z-index: 1; opacity: 0.06; pointer-events: none;
      }
      .watermark img { width: 480px; height: 480px; object-fit: contain; }

      .brand {
        position: absolute; left: 18mm; top: 12mm; z-index: 5;
        display: flex; align-items: center; gap: 10px;
      }
      .brand img { width: 38px; height: 38px; object-fit: contain; }
      .brand span {
        font-size: 12px; font-weight: 700; letter-spacing: 0.22em;
        text-transform: uppercase; color: rgba(255,255,255,0.85);
      }

      .content {
        position: relative; z-index: 4;
        height: 100%;
        display: grid;
        grid-template-columns: 110mm 1fr;
        gap: 14mm;
        padding: 30mm 18mm 18mm 18mm;
        align-items: start;
      }

      .photo-col {
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      .photo-frame {
        position: relative;
        padding: 6px;
      }
      .photo-frame::before {
        content: "";
        position: absolute; inset: -10px;
        background: linear-gradient(135deg, rgba(250,204,21,0.35), rgba(255,255,255,0.06), rgba(239,68,68,0.35));
        filter: blur(28px);
        z-index: -1;
        border-radius: 28px;
      }
      .photo {
        width: 105mm;
        height: 140mm;
        border-radius: 16px;
        object-fit: cover;
        box-shadow: 0 18px 50px -18px rgba(0,0,0,0.7);
        border: 2px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.04);
      }
      .no-photo {
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; color: rgba(255,255,255,0.7);
      }

      .details-col { min-width: 0; }

      .name {
        font-family: "Playfair Display", Georgia, serif;
        font-weight: 900;
        font-size: 38pt;
        line-height: 1.05;
        letter-spacing: -0.01em;
        margin: 0;
        color: #fff;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      .accent-bar {
        width: 56px; height: 4px; background: #facc15;
        border-radius: 999px;
        margin-top: 10px;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 18px;
      }
      .card {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        padding: 10px 12px;
      }
      .card-label {
        font-size: 8.5pt;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #facc15;
      }
      .card-value {
        margin-top: 4px;
        font-size: 11pt;
        font-weight: 600;
        color: #fff;
        white-space: pre-line;
      }
      .card-sub {
        margin-top: 2px;
        font-size: 9pt;
        color: rgba(255,255,255,0.7);
      }
      .mono {
        font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }

      .section { margin-top: 16px; }
      .section-pill {
        display: inline-block;
        background: #facc15;
        color: #1a1a1a;
        font-size: 9pt;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        padding: 6px 12px;
        border-radius: 6px;
      }
      .bullets {
        list-style: none;
        padding: 0;
        margin: 10px 0 0;
      }
      .bullets li {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        font-size: 11pt;
        line-height: 1.5;
        color: rgba(255,255,255,0.95);
        margin-top: 4px;
      }
      .dot {
        margin-top: 8px;
        width: 6px; height: 6px;
        border-radius: 999px;
        background: #facc15;
        flex: 0 0 auto;
        display: inline-block;
      }
      .pos-name { font-weight: 700; }
      .pos-period { color: rgba(255,255,255,0.75); }

      .empty {
        margin-top: 8px;
        font-size: 10.5pt;
        font-style: italic;
        color: rgba(255,255,255,0.55);
      }

      .bio {
        margin-top: 16px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        padding: 12px 14px;
      }
      .bio p {
        margin: 6px 0 0;
        font-size: 10.5pt;
        line-height: 1.55;
        color: rgba(255,255,255,0.92);
      }
    </style>
  </head>
  <body>${pages}</body>
</html>`;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const { data: settings, error: settingsErr } = await supabase
      .from("app_settings")
      .select("active_confcode")
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) {
      throw settingsErr;
    }

    const activeConfcode = settings?.active_confcode
      ? String(settings.active_confcode)
      : null;
    if (!activeConfcode) {
      return NextResponse.json(
        { error: "No active conference set." },
        { status: 400 },
      );
    }

    const { data: rows, error: candErr } = await supabase
      .from("candidates")
      .select(
        `
        id,
        full_name,
        bio,
        photo_url,
        is_active,
        confcode,
        present_position,
        lgu_address,
        highest_educational_attainment,
        geo_group:geo_groups (
          id,
          code,
          name
        )
      `,
      )
      .eq("confcode", activeConfcode)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (candErr) {
      throw candErr;
    }

    const candidates = (rows ?? []) as unknown as Candidate[];
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No active candidates to include in the presentation." },
        { status: 400 },
      );
    }

    const candidateIds = candidates.map((c) => String(c.id));
    const [{ data: phalgaRows, error: phErr }, { data: provRows, error: provErr }] =
      await Promise.all([
        supabase
          .from("candidates_prev_curr_phalga")
          .select("id, linenum, position, period_covered")
          .in("id", candidateIds)
          .order("id", { ascending: true })
          .order("linenum", { ascending: true }),
        supabase
          .from("candidates_prev_curr_provincial_league")
          .select("id, linenum, position, period_covered")
          .in("id", candidateIds)
          .order("id", { ascending: true })
          .order("linenum", { ascending: true }),
      ]);

    if (phErr || provErr) {
      console.error("candidate presentation prev/curr load failed", { phErr, provErr });
    }

    const filterMeaningful = (lines: PrevCurrLine[]) =>
      lines.filter(
        (l) =>
          (l.position && l.position.trim()) ||
          (l.period_covered && l.period_covered.trim()),
      );

    const phalgaById: Record<string, PrevCurrLine[]> = {};
    for (const row of (phalgaRows ?? []) as PrevCurrLine[]) {
      const k = String(row.id);
      if (!phalgaById[k]) phalgaById[k] = [];
      phalgaById[k].push(row);
    }
    for (const k of Object.keys(phalgaById)) {
      phalgaById[k] = filterMeaningful(phalgaById[k]);
    }

    const provincialById: Record<string, PrevCurrLine[]> = {};
    for (const row of (provRows ?? []) as PrevCurrLine[]) {
      const k = String(row.id);
      if (!provincialById[k]) provincialById[k] = [];
      provincialById[k].push(row);
    }
    for (const k of Object.keys(provincialById)) {
      provincialById[k] = filterMeaningful(provincialById[k]);
    }

    const [bgDataUrl, logoDataUrl, photoDataUrls] = await Promise.all([
      getBgDataUrl(),
      getLogoDataUrl(),
      // Pre-fetch every candidate photo as a data: URL so puppeteer doesn't have
      // to make external image requests during PDF rendering. A single slow/blocked
      // image used to push setContent past `networkidle0`'s 60s timeout.
      Promise.all(
        candidates.map((c) =>
          c.photo_url ? fetchImageAsDataUrl(String(c.photo_url)) : Promise.resolve(null),
        ),
      ),
    ]);

    const candidatesInlined = candidates.map((c, i) => ({
      ...c,
      photo_url: photoDataUrls[i] ?? null,
    }));

    const html = renderHtml({
      candidates: candidatesInlined,
      phalgaById,
      provincialById,
      bgDataUrl,
      logoDataUrl,
      confcode: activeConfcode,
    });

    const filename = `Candidates_Presentation_${fileSafe(activeConfcode)}_${tsSafe(
      new Date(),
    )}.pdf`;

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45_000);
    page.setDefaultTimeout(45_000);
    // `networkidle0` was hanging when an external resource (Google Fonts CDN or
    // an unreachable photo URL) never settled. With photos inlined above, we just
    // need DOM + main resources to load.
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 });
    // Best-effort wait for web fonts so the PDF uses the intended typography. Falls
    // back to the system font stack after 4s if Google Fonts can't be reached.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const ready = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
            ?.ready;
          if (!ready) {
            resolve();
            return;
          }
          const done = () => resolve();
          ready.then(done, done);
          setTimeout(done, 4000);
        }),
    );
    const pdf = await page.pdf({
      width: "297mm",
      height: "210mm",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("candidates presentation pdf generation failed", e);
    const { message } = toPublicMessage(e, "Unable to generate presentation PDF.");
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}
