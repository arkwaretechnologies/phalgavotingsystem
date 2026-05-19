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
  comelec_position: string | null;
  sort_order: number | null;
  lgu: string | null;
  province: string | null;
  confcode: string | null;
  photo_url: string | null;
};

function comelecPositionLabel(member: ComelecMember): string {
  return (member.comelec_position ?? "").trim() || "COMELEC MEMBER";
}

function escapeHtmlWithBreaks(s: string) {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

function sortComelecMembersForPresentation(list: ComelecMember[]): ComelecMember[] {
  return [...list].sort((a, b) => {
    const sa = a.sort_order ?? 999_999;
    const sb = b.sort_order ?? 999_999;
    if (sa !== sb) return sa - sb;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
      sensitivity: "base",
    });
  });
}

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

function renderCard(label: string, value: string, opts?: { valueMedium?: boolean }) {
  const valueClass = opts?.valueMedium ? "card-value card-value-medium" : "card-value";
  return `<div class="card">
    <div class="card-label">${escapeHtml(label)}</div>
    <div class="${valueClass}">${escapeHtml(value)}</div>
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
  const positionLabelHtml = escapeHtmlWithBreaks(comelecPositionLabel(member));
  const hasCustomPosition = Boolean((member.comelec_position ?? "").trim());

  const photoBlock = hasPhoto
    ? `<div class="photo-frame"><img class="photo" src="${photoSrc}" alt="${escapeHtml(displayName)} portrait" /></div>`
    : `<div class="photo-frame photo-placeholder">
        <p class="comelec-title-sub">Republic of the Philippines</p>
        <p class="comelec-title-main">${
          hasCustomPosition ? positionLabelHtml : "COMELEC<br/>Member"
        }</p>
      </div>`;

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

    <div class="layout">
      <div class="photo-col">
        <div class="photo-stack">
          <div class="photo-glow" aria-hidden="true"></div>
          ${photoBlock}
        </div>
        ${hasPhoto ? `<p class="comelec-caption">${positionLabelHtml}</p>` : ""}
      </div>

      <div class="details-col">
        <div class="name-block">
          <h1 class="name">${escapeHtml(displayName)}</h1>
          <div class="accent-bar"></div>
        </div>
        <div class="cards">
          ${member.position ? renderCard("Position", member.position) : ""}
          ${member.lgu ? renderCard("LGU", member.lgu, { valueMedium: true }) : ""}
          ${member.province ? renderCard("Province", member.province) : ""}
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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap"
      rel="stylesheet"
    />
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
      .brand img { width: 40px; height: 40px; object-fit: contain; }
      .brand span {
        font-size: 11px; font-weight: 700; letter-spacing: 0.22em;
        text-transform: uppercase; color: rgba(255,255,255,0.85);
      }

      /* Match /admin/comelec-members/[id] lg profile (34rem photo, Playfair name, #facc15 accents) */
      .layout {
        position: relative;
        z-index: 4;
        display: grid;
        grid-template-columns: 144mm minmax(0, 1fr);
        gap: 15mm;
        align-items: center;
        min-height: calc(210mm - 20mm);
        margin: 0 14mm;
        padding: 22mm 0 12mm;
      }

      .photo-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2mm;
      }

      .photo-stack {
        position: relative;
        width: 144mm;
      }

      .photo-glow {
        position: absolute;
        inset: -4mm;
        border-radius: 8mm;
        background: linear-gradient(
          135deg,
          rgba(250, 204, 21, 0.4),
          rgba(255, 255, 255, 0.1),
          rgba(239, 68, 68, 0.4)
        );
        filter: blur(24px);
        z-index: 0;
      }

      .photo-frame {
        position: relative;
        z-index: 1;
        width: 144mm;
        height: 144mm;
        overflow: hidden;
        border-radius: 7.4mm;
        box-shadow: 0 8mm 21mm -8mm rgba(0, 0, 0, 0.7);
        border: 2px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
      }

      .photo-frame.photo-placeholder {
        display: grid;
        place-items: center;
        text-align: center;
        padding: 6mm;
      }

      .photo {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center center;
      }

      .comelec-caption {
        width: 144mm;
        margin: 0;
        padding: 2mm 8mm 0;
        text-align: center;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        font-weight: 700;
        font-size: 27pt;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #facc15;
        line-height: 1.2;
        white-space: pre-line;
      }

      .comelec-title-sub {
        margin: 0;
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #facc15;
      }

      .comelec-title-main {
        margin: 4mm 0 0;
        font-family: "Playfair Display", Georgia, "Times New Roman", serif;
        font-weight: 900;
        font-size: 27pt;
        line-height: 1.1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #fff;
        white-space: pre-line;
      }

      .details-col {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6mm;
      }

      .name-block .accent-bar {
        margin-top: 3mm;
      }

      .name {
        font-family: "Playfair Display", Georgia, "Times New Roman", serif;
        font-weight: 900;
        font-size: 39pt;
        line-height: 1.05;
        letter-spacing: -0.02em;
        margin: 0;
        color: #fff;
        word-wrap: break-word;
      }

      .accent-bar {
        width: 17mm;
        height: 1mm;
        background: #facc15;
        border-radius: 999px;
        margin-top: 0;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 3mm;
        margin-top: 0;
      }

      .card {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4.2mm;
        padding: 4mm;
      }

      .card-label {
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #facc15;
      }

      .card-value {
        margin-top: 1mm;
        font-size: 11.25pt;
        font-weight: 600;
        color: #fff;
        white-space: pre-line;
      }

      .card-value-medium {
        font-weight: 500;
        color: rgba(255, 255, 255, 0.95);
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
      .select("id, name, position, comelec_position, sort_order, lgu, province, confcode, photo_url")
      .eq("confcode", activeConfcode);

    if (membersErr) throw membersErr;

    const members: ComelecMember[] = sortComelecMembersForPresentation(
      (rows ?? []).map((r) => ({
        id: String(r.id),
        name: r.name ?? null,
        position: r.position ?? null,
        comelec_position: r.comelec_position ?? null,
        sort_order: r.sort_order == null ? null : Number(r.sort_order),
        lgu: r.lgu ?? null,
        province: r.province ?? null,
        confcode: r.confcode ?? null,
        photo_url: r.photo_url ?? null,
      })),
    );

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
        members.map((m) =>
          m.photo_url
            ? fetchImageAsDataUrl(String(m.photo_url), {
                maxInlineBytes: 2 * 1024 * 1024,
                supabaseTransformWidth: 900,
                supabaseTransformResize: "contain",
              })
            : Promise.resolve(null),
        ),
      ),
    ]);

    const membersInlined: ComelecMember[] = members.map((m, i) => ({
      ...m,
      photo_url: photoDataUrls[i] ?? m.photo_url,
    }));

    const html = renderHtml({
      members: membersInlined,
      bgDataUrl,
      logoDataUrl,
      confcode: activeConfcode,
    });
    const filename = `COMELEC_Members_Presentation_${fileSafe(activeConfcode)}_${tsSafe(new Date())}.pdf`;

    const pdf = await renderHtmlToLandscapePdfBuffer(html, { waitForImages: true });

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
