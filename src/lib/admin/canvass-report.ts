import "server-only";

import type { AdminResultsPayload, AdminResultsTallyRow } from "@/lib/admin/results-tallies-types";
import path from "node:path";
import { readFile } from "node:fs/promises";

export type CanvassSignatureBlock = {
  label: string;
  lines: number;
};

export type CanvassGeoSection = {
  geo_group_id: number | null;
  title: string;
  rows: Array<{ candidate_id: string; full_name: string; vote_count: number }>;
  subtotalVotes: number;
};

export type CanvassReportModel = {
  confcode: string;
  conferenceName: string | null;
  generatedAt: string;
  totalVotes: number;
  totalVoters: number;
  sections: CanvassGeoSection[];
  signatures: CanvassSignatureBlock[];
};

function sortRowsForReport(rows: AdminResultsTallyRow[], geoOrder: Map<number, number>) {
  return [...rows].sort((a, b) => {
    const ga = a.geo_group_id ?? -1;
    const gb = b.geo_group_id ?? -1;
    const oa = geoOrder.get(ga) ?? 999;
    const ob = geoOrder.get(gb) ?? 999;
    if (oa !== ob) return oa - ob;
    const sa = a.sort_order ?? 0;
    const sb = b.sort_order ?? 0;
    if (sa !== sb) return sa - sb;
    return a.full_name.localeCompare(b.full_name);
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let cachedCanvassHeaderDataUrl: string | null | undefined;
export async function getCanvassReportHeaderDataUrl() {
  if (cachedCanvassHeaderDataUrl !== undefined) return cachedCanvassHeaderDataUrl;
  try {
    const fp = path.join(process.cwd(), "public", "canvass-report-header.jpg");
    const bytes = await readFile(fp);
    cachedCanvassHeaderDataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    cachedCanvassHeaderDataUrl = null;
  }
  return cachedCanvassHeaderDataUrl;
}

export function buildCanvassReportModel(payload: AdminResultsPayload): CanvassReportModel | null {
  if (!payload.activeConfcode) return null;

  const geoOrder = new Map<number, number>();
  (payload.geoGroups ?? []).forEach((g, i) => geoOrder.set(g.id, i));

  const sorted = sortRowsForReport(payload.rows ?? [], geoOrder);
  const totalVotes = sorted.reduce((acc, r) => acc + (Number.isFinite(r.vote_count) ? r.vote_count : 0), 0);

  const geoLabel = (geoId: number | null) => {
    if (geoId == null) return "— Unassigned";
    const g = payload.geoGroups.find((x) => x.id === geoId);
    return g ? `${g.code} — ${g.name}` : `Geo #${geoId}`;
  };

  const byGeo = new Map<number | null, AdminResultsTallyRow[]>();
  for (const r of sorted) {
    const k = r.geo_group_id ?? null;
    const list = byGeo.get(k) ?? [];
    list.push(r);
    byGeo.set(k, list);
  }

  const geoKeys = [...byGeo.keys()].sort((a, b) => {
    const oa = a == null ? 999 : geoOrder.get(a) ?? 999;
    const ob = b == null ? 999 : geoOrder.get(b) ?? 999;
    return oa - ob;
  });

  const sections: CanvassGeoSection[] = geoKeys.map((k) => {
    const rows = (byGeo.get(k) ?? []).map((r) => ({
      candidate_id: r.candidate_id,
      full_name: r.full_name,
      vote_count: r.vote_count,
    }));
    const subtotalVotes = rows.reduce((acc, r) => acc + (Number.isFinite(r.vote_count) ? r.vote_count : 0), 0);
    return { geo_group_id: k, title: geoLabel(k), rows, subtotalVotes };
  });

  return {
    confcode: payload.activeConfcode,
    conferenceName: payload.conferenceName ?? null,
    generatedAt: payload.fetchedAt,
    totalVotes,
    totalVoters: payload.totalVoters ?? 0,
    sections,
    signatures: [
      { label: "Prepared by", lines: 1 },
      { label: "Reviewed by", lines: 1 },
      { label: "Witnesses", lines: 7 },
    ],
  };
}

export function renderCanvassReportHtml(
  model: CanvassReportModel,
  opts?: { headerDataUrl?: string | null },
): string {
  const title = `Canvass Report — ${model.confcode}`;
  const headerSub = model.conferenceName ? `${model.confcode} · ${model.conferenceName}` : model.confcode;

  const css = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; }
    .page { padding: 28px; }
    .reportHeader { width: 100%; margin: 0 0 12px; }
    .reportHeader img { display: block; width: 100%; height: auto; }
    .header { display: flex; justify-content: space-between; gap: 16px; }
    .h1 { font-size: 18px; font-weight: 700; margin: 0; }
    .sub { margin-top: 4px; color: #444; font-size: 12px; }
    .meta { text-align: right; font-size: 12px; color: #444; }
    .card { margin-top: 14px; border: 1px solid #ddd; border-radius: 12px; padding: 12px; }
    .stats { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #333; }
    .stat b { color: #111; }
    h2 { font-size: 13px; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; line-height: 1.35; }
    th, td { border-bottom: 1px solid #e8e8e8; padding: 10px 10px; vertical-align: middle; }
    thead th {
      background: linear-gradient(to bottom, #fafafa, #f2f2f3);
      color: #52525b;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-align: left;
      text-transform: uppercase;
    }
    tbody tr:hover { background: #f8f8f8; }
    tbody tr:last-child td { border-bottom: none; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .sectionTitle { margin-top: 18px; font-size: 13px; font-weight: 700; }
    .subtotal { margin-top: 6px; font-size: 12px; color: #444; }
    .signatures { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sig { border: 1px solid #ddd; border-radius: 12px; padding: 12px; }
    .sigLabel { font-size: 12px; color: #555; margin-bottom: 10px; }
    .line { border-bottom: 1px solid #111; height: 18px; margin-top: 10px; }
    .line.witness { height: 40px; margin-top: 12px; }
    .footerNote { margin-top: 18px; font-size: 11px; color: #666; }
    @page { margin: 14mm; }
    @media print {
      .page { padding: 0; }
      .card, .sig { border-color: #999; }
    }
  `;

  const sectionsHtml = model.sections
    .map((s) => {
      const rows = s.rows
        .map(
          (r) => `
            <tr>
              <td>${escapeHtml(r.full_name)}</td>
              <td class="num">${escapeHtml(String(r.vote_count ?? 0))}</td>
            </tr>
          `,
        )
        .join("");
      return `
        <div class="section">
          <div class="sectionTitle">${escapeHtml(s.title)}</div>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th style="text-align:right;">Votes</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="2" style="color:#666; padding:10px 6px;">No candidates.</td></tr>`}
            </tbody>
          </table>
          <div class="subtotal">Subtotal votes: <b>${escapeHtml(String(s.subtotalVotes))}</b></div>
        </div>
      `;
    })
    .join("");

  const sigHtml = model.signatures
    .map((s) => {
      const isWitness = s.label.trim().toLowerCase() === "witnesses";
      const lineClass = isWitness ? "line witness" : "line";
      const lines = Array.from({ length: s.lines })
        .map(() => `<div class="${lineClass}"></div>`)
        .join("");
      return `<div class="sig"><div class="sigLabel">${escapeHtml(s.label)}</div>${lines}</div>`;
    })
    .join("");

  const headerImg = opts?.headerDataUrl
    ? `<div class="reportHeader"><img src="${opts.headerDataUrl}" alt="Canvass report header" /></div>`
    : "";

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="page">
        ${headerImg}
        <div class="header">
          <div>
            <div class="h1">Canvass Report</div>
            <div class="sub">${escapeHtml(headerSub)}</div>
          </div>
          <div class="meta">
            Generated: ${escapeHtml(new Date(model.generatedAt).toLocaleString())}<br/>
            Total votes recorded: <b>${escapeHtml(String(model.totalVotes))}</b><br/>
            Voter roll: <b>${escapeHtml(String(model.totalVoters))}</b>
          </div>
        </div>

        <div class="card">
          <div class="stats">
            <div class="stat"><b>Conference:</b> ${escapeHtml(headerSub)}</div>
            <div class="stat"><b>Timestamp:</b> ${escapeHtml(new Date(model.generatedAt).toLocaleString())}</div>
          </div>
        </div>

        ${sectionsHtml}

        <div class="signatures">
          ${sigHtml}
        </div>

        <div class="footerNote">
          This report summarizes votes from submitted ballots only.
        </div>
      </div>
    </body>
  </html>`;
}

