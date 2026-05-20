import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toPublicMessage } from "@/lib/errors/public-message";
import { VOTER_GEO_AREAS, voterGeoReportBucket } from "@/lib/voters/geo-area";

type SubmittedBallotRow = { voter_id: string | null };
type VoterGeoRow = { id: string; geo_area: string | null };

export type ReportsOverviewModel = {
  generatedAt: string;
  confcode: string | null;
  conferenceName: string | null;
  totalVoters: number;
  votedVoters: number;
  inactiveVoters: number;
  votedPct: number;
  inactivePct: number;
  geoTableRows: Array<{ geo: string; total: number; voted: number; inactive: number }>;
};

async function loadVoterGeoRows(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
): Promise<VoterGeoRow[]> {
  try {
    return await fetchAllRows<VoterGeoRow>(
      async (from, to) =>
        await supabase
          .from("voters")
          .select("id, geo_area")
          .order("id", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    );
  } catch (e) {
    const m = String((e as Error)?.message ?? e).toLowerCase();
    if (!m.includes("geo_area") && !m.includes("column")) throw e;
    const ids = await fetchAllRows<{ id: string }>(
      async (from, to) =>
        await supabase.from("voters").select("id").order("id", { ascending: true }).range(from, to),
      { pageSize: 2000 },
    );
    return ids.map((r) => ({ id: r.id, geo_area: null }));
  }
}

/** Loads voter roll + ballot stats for Reports overview (screen, print, PDF). */
export async function loadReportsOverviewModel(): Promise<ReportsOverviewModel> {
  const supabase = createSupabaseServiceRoleClient();
  const generatedAt = new Date().toISOString();

  const [{ data: settings, error: settingsErr }, voterRows, submitted] = await Promise.all([
    supabase.from("app_settings").select("active_confcode").eq("id", 1).maybeSingle(),
    loadVoterGeoRows(supabase),
    fetchAllRows<SubmittedBallotRow>(
      async (from, to) =>
        await supabase
          .from("ballots")
          .select("voter_id")
          .eq("is_submitted", true)
          .order("created_at", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    ),
  ]);

  if (settingsErr) {
    const { message } = toPublicMessage(settingsErr, "Unable to load app settings.");
    throw new Error(message);
  }

  const confcodeRaw = (settings as { active_confcode?: string | null } | null)?.active_confcode;
  const confcode =
    confcodeRaw != null && String(confcodeRaw).trim() !== "" ? String(confcodeRaw).trim() : null;

  let conferenceName: string | null = null;
  if (confcode) {
    const { data: confRow } = await supabase
      .from("conference")
      .select("name")
      .eq("confcode", confcode)
      .maybeSingle();
    conferenceName =
      confRow && typeof (confRow as { name?: unknown }).name === "string"
        ? String((confRow as { name: string }).name)
        : null;
  }

  const totalVoters = voterRows.length;

  const submittedVoterIds = new Set(
    submitted
      .map((r) => (r.voter_id ? String(r.voter_id) : ""))
      .filter((x) => x.length > 0),
  );
  const votedVoters = voterRows.filter((v) => submittedVoterIds.has(String(v.id))).length;
  const inactiveVoters = Math.max(0, totalVoters - votedVoters);
  const votedPct = totalVoters > 0 ? (votedVoters / totalVoters) * 100 : 0;
  const inactivePct = totalVoters > 0 ? (inactiveVoters / totalVoters) * 100 : 0;

  const buckets = new Map<string, { total: number; voted: number }>();
  for (const g of [...VOTER_GEO_AREAS, "Other", "Unassigned"] as string[]) {
    buckets.set(g, { total: 0, voted: 0 });
  }

  for (const v of voterRows) {
    const key = voterGeoReportBucket(v.geo_area);
    const b = buckets.get(key);
    if (!b) continue;
    b.total += 1;
    if (submittedVoterIds.has(String(v.id))) b.voted += 1;
  }

  const displayKeys = [...VOTER_GEO_AREAS, "Unassigned"];
  if ((buckets.get("Other")?.total ?? 0) > 0) displayKeys.push("Other");

  const geoTableRows = displayKeys.map((geo) => {
    const b = buckets.get(geo) ?? { total: 0, voted: 0 };
    return { geo, total: b.total, voted: b.voted, inactive: Math.max(0, b.total - b.voted) };
  });

  return {
    generatedAt,
    confcode,
    conferenceName,
    totalVoters,
    votedVoters,
    inactiveVoters,
    votedPct,
    inactivePct,
    geoTableRows,
  };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function headerSubline(model: ReportsOverviewModel): string {
  if (model.confcode && model.conferenceName) {
    return `${model.confcode} · ${model.conferenceName}`;
  }
  return model.confcode ?? "—";
}

/** Full HTML document for print/PDF; uses same top banner image as canvass report when provided. */
export function renderReportsOverviewHtml(
  model: ReportsOverviewModel,
  opts?: { headerDataUrl?: string | null; includePrintButton?: boolean },
): string {
  const title = "Reports — Overview";
  const headerSub = headerSubline(model);
  const headerImg = opts?.headerDataUrl
    ? `<div class="reportHeader"><img src="${opts.headerDataUrl}" alt="Report header" /></div>`
    : "";

  const geoRows = model.geoTableRows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.geo)}</td>
        <td class="num">${escapeHtml(String(row.voted))}</td>
        <td class="num">${escapeHtml(String(row.inactive))}</td>
        <td class="num">${escapeHtml(String(row.total))}</td>
      </tr>`,
    )
    .join("");

  const printBtn = opts?.includePrintButton
    ? `<p class="no-print toolbar"><button type="button" onclick="window.print()">Print</button></p>`
    : "";

  const css = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; }
    .page { padding: 28px; }
    .reportHeader { width: 100%; margin: 0 0 12px; }
    .reportHeader img { display: block; width: 100%; height: auto; }
    .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
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
    tbody tr:last-child td { border-bottom: none; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .barWrap { margin-top: 12px; height: 12px; border-radius: 999px; overflow: hidden; background: #f4f4f5; border: 1px solid #e4e4e7; display: flex; }
    .barVoted { height: 100%; background: #1e3a5f; }
    .barInactive { height: 100%; background: #d4d4d8; }
    .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .kpi { border: 1px solid #ddd; border-radius: 12px; padding: 12px; }
    .kpi .lbl { font-size: 11px; color: #666; font-weight: 600; }
    .kpi .val { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .kpi .pct { font-size: 11px; color: #666; margin-top: 2px; }
    .footerNote { margin-top: 18px; font-size: 11px; color: #666; }
    .toolbar { margin: 0 0 12px; }
    .toolbar button {
      font-size: 13px; padding: 8px 14px; border-radius: 8px; border: 1px solid #ccc; background: #fff; cursor: pointer;
    }
    .toolbar button:hover { background: #f9f9f9; }
    @page { margin: 14mm; }
    @media print {
      .page { padding: 0; }
      .no-print { display: none !important; }
      .card, .kpi { border-color: #999; }
    }
  `;

  const votedW = Math.min(100, Math.max(0, model.votedPct));
  const inactiveW = Math.min(100, Math.max(0, model.inactivePct));

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
      ${printBtn}
      ${headerImg}
      <div class="header">
        <div>
          <div class="h1">Reports — Overview</div>
          <div class="sub">${escapeHtml(headerSub)}</div>
        </div>
        <div class="meta">
          Generated: ${escapeHtml(new Date(model.generatedAt).toLocaleString())}<br/>
          Total voters: <b>${escapeHtml(String(model.totalVoters))}</b>
        </div>
      </div>

      <div class="card">
        <h2>Voted vs inactive</h2>
        <div class="barWrap" title="Voted vs inactive share">
          <div class="barVoted" style="width:${votedW}%"></div>
          <div class="barInactive" style="width:${inactiveW}%"></div>
        </div>
        <div class="kpis">
          <div class="kpi">
            <div class="lbl">Voted voters</div>
            <div class="val">${escapeHtml(String(model.votedVoters))}</div>
            <div class="pct">${escapeHtml(model.votedPct.toFixed(1))}%</div>
          </div>
          <div class="kpi">
            <div class="lbl">Inactive voters</div>
            <div class="val">${escapeHtml(String(model.inactiveVoters))}</div>
            <div class="pct">${escapeHtml(model.inactivePct.toFixed(1))}%</div>
          </div>
        </div>
      </div>

      <h2>By geo area</h2>
      <p style="margin:0 0 8px; font-size:12px; color:#555;">
        Grouped by <span style="font-family:ui-monospace,monospace">voters.geo_area</span>. Inactive = no submitted ballot.
      </p>
      <table>
        <thead>
          <tr>
            <th>Geo area</th>
            <th style="text-align:right">Voted</th>
            <th style="text-align:right">Inactive</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${geoRows}</tbody>
      </table>

      <div class="footerNote">
        This overview summarizes the voter roll and submitted ballots only.
      </div>
    </div>
  </body>
</html>`;
}
