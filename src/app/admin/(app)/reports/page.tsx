import Link from "next/link";
import { toPublicMessage } from "@/lib/errors/public-message";
import { loadReportsOverviewModel } from "@/lib/admin/reports-overview";

export default async function AdminReportsPage() {
  let model: Awaited<ReturnType<typeof loadReportsOverviewModel>>;
  try {
    model = await loadReportsOverviewModel();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("reports overview load failed", e);
    const { message } = toPublicMessage(e, "Unable to load reports overview right now.");
    throw new Error(message);
  }

  const {
    totalVoters,
    votedVoters,
    inactiveVoters,
    votedPct,
    inactivePct,
    geoTableRows,
    confcode,
    conferenceName,
  } = model;

  const confLabel =
    confcode && conferenceName ? `${confcode} · ${conferenceName}` : confcode ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Exportable reports for auditing and post-election documentation.
        </p>
        {confLabel ? (
          <p className="mt-2 text-xs text-neutral-500">
            Active conference: <span className="font-mono text-neutral-700">{confLabel}</span>
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/admin/reports/overview-print"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            Print overview
          </a>
          <a
            href="/admin/reports/overview-pdf"
            className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            Download overview PDF
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Voted vs Inactive</div>
          </div>
          <div className="text-xs text-neutral-600">
            Total voters: <span className="font-mono">{totalVoters}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200/70">
            <div className="flex h-full w-full">
              <div
                className="ph-brand-bar h-full"
                style={{ width: `${Math.min(100, Math.max(0, votedPct))}%` }}
                title={`Voted: ${votedVoters} (${votedPct.toFixed(1)}%)`}
              />
              <div
                className="h-full bg-neutral-300"
                style={{ width: `${Math.min(100, Math.max(0, inactivePct))}%` }}
                title={`Inactive: ${inactiveVoters} (${inactivePct.toFixed(1)}%)`}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
              <div className="text-xs font-medium text-neutral-600">Voted voters</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{votedVoters}</div>
              <div className="mt-1 text-xs text-neutral-500">{votedPct.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
              <div className="text-xs font-medium text-neutral-600">Inactive voters</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{inactiveVoters}</div>
              <div className="mt-1 text-xs text-neutral-500">{inactivePct.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">By geo area</div>
        <p className="mt-1 text-xs text-neutral-600">
          Voters are grouped by <span className="font-mono">voters.geo_area</span>. Inactive = no submitted ballot.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200/80">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Geo area</th>
                <th className="px-4 py-3 text-right">Voted</th>
                <th className="px-4 py-3 text-right">Inactive</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {geoTableRows.map((row) => (
                <tr key={row.geo} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{row.geo}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-800">{row.voted}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-800">{row.inactive}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Available reports</div>
        <div className="mt-4 grid gap-3">
          <Link
            href="/admin/reports/candidates"
            className="rounded-xl border border-neutral-200/80 p-4 hover:bg-neutral-50"
          >
            <div className="font-medium text-neutral-900">Candidates</div>
            <div className="mt-1 text-sm text-neutral-600">
              Simple list of candidate names for the active conference.
            </div>
          </Link>
          <Link
            href="/admin/reports/voted-voters"
            className="rounded-xl border border-neutral-200/80 p-4 hover:bg-neutral-50"
          >
            <div className="font-medium text-neutral-900">Voted Voters</div>
            <div className="mt-1 text-sm text-neutral-600">
              Lists voters with a submitted ballot (casted their vote).
            </div>
          </Link>
          <Link
            href="/admin/reports/non-participating-voters"
            className="rounded-xl border border-neutral-200/80 p-4 hover:bg-neutral-50"
          >
            <div className="font-medium text-neutral-900">Inactive Voters</div>
            <div className="mt-1 text-sm text-neutral-600">
              Lists voters with no submitted ballot (did not vote).
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
