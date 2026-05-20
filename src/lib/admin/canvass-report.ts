import "server-only";

import type {
  AdminResultsComelecMember,
  AdminResultsPayload,
  AdminResultsTallyRow,
} from "@/lib/admin/results-tallies-types";
import path from "node:path";
import { readFile } from "node:fs/promises";

export type CanvassSignatoryRow = {
  /** Printed above the signature line (name, role, optional LGU-style position). */
  textLines: string[];
};

export type CanvassSignatureSection = {
  label: string;
  /** `witness` uses a taller signature line per row. */
  variant: "compact" | "witness";
  rows: CanvassSignatoryRow[];
  /** When true, section spans full width under the two-column grid. */
  fullWidth?: boolean;
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
  signatureSections: CanvassSignatureSection[];
};

function sortRowsForReport(rows: AdminResultsTallyRow[], geoOrder: Map<number, number>) {
  return [...rows].sort((a, b) => {
    const ga = a.geo_group_id ?? -1;
    const gb = b.geo_group_id ?? -1;
    const oa = geoOrder.get(ga) ?? 999;
    const ob = geoOrder.get(gb) ?? 999;
    if (oa !== ob) return oa - ob;
    const va = Number.isFinite(a.vote_count) ? a.vote_count : 0;
    const vb = Number.isFinite(b.vote_count) ? b.vote_count : 0;
    if (va !== vb) return vb - va;
    return a.full_name.localeCompare(b.full_name);
  });
}

function normComelecRole(s: string | null | undefined): string {
  return String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function isSecretary(comelec_position: string | null): boolean {
  return normComelecRole(comelec_position).includes("SECRETARY");
}

function isChairman(comelec_position: string | null): boolean {
  const n = normComelecRole(comelec_position);
  if (!n) return false;
  if (n.includes("VICE") || n.includes("DEPUTY")) return false;
  return (
    n.includes("CHAIRMAN") ||
    n.includes("CHAIRPERSON") ||
    n.includes("CHAIR OF") ||
    n.endsWith(" CHAIR") ||
    n === "CHAIR"
  );
}

function sortComelecMembers(a: AdminResultsComelecMember, b: AdminResultsComelecMember): number {
  const sa = a.sort_order ?? 999_999;
  const sb = b.sort_order ?? 999_999;
  if (sa !== sb) return sa - sb;
  return String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" });
}

/** Name plus COMELEC position line only (`comelec_position`; no separate `position` field). */
function textLinesForSignatory(m: AdminResultsComelecMember): string[] {
  const name = String(m.name ?? "").trim() || "—";
  const role = String(m.comelec_position ?? "").trim() || "COMELEC MEMBER";
  return [name, role];
}

function buildSignatureSections(members: AdminResultsComelecMember[]): CanvassSignatureSection[] {
  const sorted = [...members].sort(sortComelecMembers);

  const secretary = sorted.find((m) => isSecretary(m.comelec_position)) ?? null;
  const chairman = sorted.find((m) => isChairman(m.comelec_position)) ?? null;

  const used = new Set<string>();
  if (secretary) used.add(secretary.id);
  if (chairman) used.add(chairman.id);

  const witnesses = sorted.filter((m) => !used.has(m.id));

  const witnessRows: CanvassSignatoryRow[] = witnesses.map((m) => ({
    textLines: textLinesForSignatory(m),
  }));
  while (witnessRows.length < 3) {
    witnessRows.push({ textLines: [] });
  }
  const witnessRowsCapped = witnessRows.slice(0, 12);

  return [
    {
      label: "Prepared by",
      variant: "compact",
      rows: [{ textLines: secretary ? textLinesForSignatory(secretary) : [] }],
    },
    {
      label: "Reviewed by",
      variant: "compact",
      rows: [{ textLines: chairman ? textLinesForSignatory(chairman) : [] }],
    },
    {
      label: "Witnesses",
      variant: "witness",
      fullWidth: true,
      rows: witnessRowsCapped,
    },
  ];
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
    if (!g) return `Geo #${geoId}`;
    const name = String(g.name ?? "").trim();
    return name.length > 0 ? name : `Geo #${geoId}`;
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
    signatureSections: buildSignatureSections(payload.comelecMembers ?? []),
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
    .sigWide { grid-column: 1 / -1; }
    .sigWitness .sigLabel { margin-bottom: 50px; }
    .witnessStack {
      display: flex;
      flex-direction: column;
      gap: 50px;
    }
    .sigWide .witnessStack .sigRow { margin-top: 0; }
    .witnessStack .sigPrefill { margin-bottom: 6px; }
    .witnessStack .line.witness { margin-top: 6px; height: 28px; }
    .sigLabel { font-size: 12px; color: #555; margin-bottom: 8px; font-weight: 600; }
    .sigCompact .sigPrefill { text-align: center; }
    .sigCompact .sigPrefill > div { text-align: center; }
    .sigRow { margin-top: 12px; }
    .sigRow:first-of-type { margin-top: 0; }
    .sigPrefill { font-size: 11px; color: #333; line-height: 1.4; margin-bottom: 6px; min-height: 14px; }
    .sigPrefill.sigPrefillEmpty { color: #ccc; }
    .sigPrefill strong { font-weight: 600; color: #111; }
    .line { border-bottom: 1px solid #111; height: 16px; margin-top: 4px; }
    .line.witness { height: 34px; margin-top: 6px; }
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

  const sigHtml = model.signatureSections
    .map((sec) => {
      const wideClass = sec.fullWidth ? " sigWide" : "";
      const rowsHtml = sec.rows
        .map((row) => {
          const lineClass = sec.variant === "witness" ? "line witness" : "line";
          const prefill =
            row.textLines.length > 0
              ? `<div class="sigPrefill">${row.textLines
                  .map((line, i) =>
                    i === 0
                      ? `<div><strong>${escapeHtml(line)}</strong></div>`
                      : `<div>${escapeHtml(line)}</div>`,
                  )
                  .join("")}</div>`
              : `<div class="sigPrefill sigPrefillEmpty">&nbsp;</div>`;
          return `<div class="sigRow">${prefill}<div class="${lineClass}"></div></div>`;
        })
        .join("");
      const witnessBody =
        sec.variant === "witness" ? `<div class="witnessStack">${rowsHtml}</div>` : rowsHtml;
      const compactClass = sec.variant === "compact" ? " sigCompact" : "";
      const witnessClass = sec.variant === "witness" ? " sigWitness" : "";
      return `<div class="sig${wideClass}${compactClass}${witnessClass}"><div class="sigLabel">${escapeHtml(sec.label)}</div>${witnessBody}</div>`;
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

