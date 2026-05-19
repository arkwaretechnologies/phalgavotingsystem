import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAdminSession } from "@/lib/admin/session";
import { sessionHasAdminPageAccess } from "@/lib/admin/path-access";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchImageAsDataUrl } from "@/lib/pdf/fetch-image-data-url";
import { renderHtmlToLandscapePdfBuffer } from "@/lib/pdf/render-html-to-pdf";
import { toPublicMessage } from "@/lib/errors/public-message";

export const runtime = "nodejs";
export const maxDuration = 300;

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

type ComelecMember = {
  id: string;
  name: string | null;
  position: string | null;
  lgu: string | null;
  province: string | null;
  confcode: string | null;
  photo_url: string | null;
};

let cachedBgDataUrl: string | null | undefined;
let cachedLogoDataUrl: string | null | undefined;

async function readPublicAsDataUrl(filename: string, mimeType: string): Promise<string | null> {
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

function renderCard(label: string, value: string) {
  return `<div class="card">
    <div class="card-label">${escapeHtml(label)}</div>
    <div class="card-value">${escapeHtml(value)}</div>
  </div>`;
}

function renderMemberPage(args: {
  member: ComelecMember;
  bgDataUrl: string | null;
  logoDataUrl: string | null;
}) {
  const { member, bgDataUrl, logoDataUrl } = args;
  const displayName = (member.name ?? "").trim() || "—";
  const hasPhoto = Boolean(member.photo_url);
  const photoSrc = member.photo_url ? escapeHtml(member.photo_url) : "";

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
              ? `<img class="photo" src="${photoSrc}" alt="${escapeHtml(displayName)} portrait" />`
              : `<div class="photo no-photo comelec-title">
            <span class="comelec-title-sub">Republic of the Philippines</span>
            <span class="comelec-title-main">COMELEC<br/>MEMBER</span>
          </div>`
          }
        </div>
        ${hasPhoto ? `<div class="comelec-caption">COMELEC MEMBER</div>` : ""}
      </div>

      <div class="details-col">
        <h1 class="name">${escapeHtml(displayName)}</h1>
        <div class="accent-bar"></div>

        <div class="cards">
          ${member.position ? renderCard("Position", member.position) : ""}
          ${member.lgu ? renderCard("LGU", member.lgu) : ""}
          ${
            member.province
              ? `<div class="card">
                  <div class="card-label">Province</div>
                  ${member.province ? `<div class="card-value">${escapeHtml(member.province)}</div>` : ""}
                </div>`
              : ""
          }
        </div>
      </div>
    </div>
  </section>`;
}

function renderHtml(args: {
  members: ComelecMember[];
  bgDataUrl: string | null;
  logoDataUrl: string | null;
  confcode: string;
}) {
  const { members, bgDataUrl, logoDataUrl, confcode } = args;
  const pages = members
    .map((m) => renderMemberPage({ member: m, bgDataUrl, logoDataUrl }))
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>COMELEC Members Presentation — ${escapeHtml(confcode)}</title>
    <style>
      :root { color-scheme: light; }
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #0a0820; color: #fff; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }

      .page {
        position: relative;
        width: 297mm;
        height: 210mm;
        overflow: hidden;
        page-break-after: always;
        background: #0a0820;
      }
      .page:last-child { page-break-after: auto; }

      .bg { position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center; }
      .overlay {
        position: absolute; inset: 0; z-index: 1;
        background: linear-gradient(to bottom, rgba(10,8,32,0.40), rgba(10,8,32,0.55) 50%, rgba(10,8,32,0.85));
      }
      .watermark {
        position: absolute; right: -90px; bottom: -90px; z-index: 1;
        opacity: 0.06; pointer-events: none;
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
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
      }
      .photo-frame { position: relative; padding: 6px; }
      .comelec-caption {
        width: 105mm;
        margin-top: 10px;
        padding: 0 8px;
        text-align: center;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-weight: 700;
        font-size: 24pt;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #facc15;
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
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; padding: 16px;
      }
      .comelec-title-sub {
        font-size: 9pt; font-weight: 700; letter-spacing: 0.22em;
        text-transform: uppercase; color: #facc15;
      }
      .comelec-title-main {
        margin-top: 14px;
        font-family: Georgia, "Times New Roman", serif;
        font-weight: 900;
        font-size: 28pt;
        line-height: 1.1;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #fff;
      }

      .details-col { min-width: 0; }
      .name {
        font-family: Georgia, "Times New Roman", serif;
        font-weight: 900;
        font-size: 38pt;
        line-height: 1.05;
        margin: 0;
        color: #fff;
        word-wrap: break-word;
      }
      .accent-bar {
        width: 56px; height: 4px; background: #facc15;
        border-radius: 999px; margin-top: 10px;
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
        font-size: 8.5pt; font-weight: 700; letter-spacing: 0.16em;
        text-transform: uppercase; color: #facc15;
      }
      .card-value {
        margin-top: 4px; font-size: 11pt; font-weight: 600;
        color: #fff; white-space: pre-line;
      }
      .card-sub {
        margin-top: 2px; font-size: 9pt; color: rgba(255,255,255,0.7);
      }
      .mono {
        font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;
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
  if (!(await sessionHasAdminPageAccess(session, "comelec_members"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const { data: settings, error: settingsErr } = await supabase
      .from("app_settings")
      .select("active_confcode")
      .eq("id", 1)
      .maybeSingle();

    if (settingsErr) throw settingsErr;

    const activeConfcode = settings?.active_confcode ? String(settings.active_confcode) : null;
    if (!activeConfcode) {
      return NextResponse.json({ error: "No active conference set." }, { status: 400 });
    }

    const { data: rows, error: membersErr } = await supabase
      .from("comelec_members")
      .select("id, name, position, lgu, province, confcode, photo_url")
      .eq("confcode", activeConfcode)
      .order("name", { ascending: true });

    if (membersErr) throw membersErr;

    const members: ComelecMember[] = (rows ?? []).map((r) => ({
      id: String(r.id),
      name: r.name ?? null,
      position: r.position ?? null,
      lgu: r.lgu ?? null,
      province: r.province ?? null,
      confcode: r.confcode ?? null,
      photo_url: r.photo_url ?? null,
    }));

    if (members.length === 0) {
      return NextResponse.json(
        { error: "No COMELEC members to include in the presentation." },
        { status: 400 },
      );
    }

    const [bgDataUrl, logoDataUrl, photoDataUrls] = await Promise.all([
      getBgDataUrl(),
      getLogoDataUrl(),
      Promise.all(
        (rows ?? []).map((r) =>
          r.photo_url ? fetchImageAsDataUrl(String(r.photo_url)) : Promise.resolve(null),
        ),
      ),
    ]);

    const membersInlined: ComelecMember[] = members.map((m, i) => ({
      ...m,
      photo_url: photoDataUrls[i] ?? null,
    }));

    const html = renderHtml({
      members: membersInlined,
      bgDataUrl,
      logoDataUrl,
      confcode: activeConfcode,
    });
    const filename = `COMELEC_Members_Presentation_${fileSafe(activeConfcode)}_${tsSafe(new Date())}.pdf`;

    const pdf = await renderHtmlToLandscapePdfBuffer(html);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("comelec members presentation pdf generation failed", e);
    const { message } = toPublicMessage(e, "Unable to generate presentation PDF.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
