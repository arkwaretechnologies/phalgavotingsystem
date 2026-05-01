import Link from "next/link";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toPublicMessage } from "@/lib/errors/public-message";

export default async function AdminReportsPage() {
  const supabase = createSupabaseServiceRoleClient();
  let totalVoters = 0;
  let votedVoters = 0;

  try {
    const { count, error } = await supabase
      .from("voters")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    totalVoters = Number(count ?? 0);

    const submitted = await fetchAllRows<{ voter_id: string | null }>(
      (from, to) =>
        supabase
          .from("ballots")
          .select("voter_id")
          .eq("is_submitted", true)
          .order("created_at", { ascending: true })
          .range(from, to),
      { pageSize: 2000 },
    );
    votedVoters = new Set(
      submitted
        .map((r) => (r.voter_id ? String(r.voter_id) : ""))
        .filter((x) => x.length > 0),
    ).size;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("reports overview load failed", e);
    const { message } = toPublicMessage(e, "Unable to load reports overview right now.");
    throw new Error(message);
  }

  const inactiveVoters = Math.max(0, totalVoters - votedVoters);
  const votedPct = totalVoters > 0 ? (votedVoters / totalVoters) * 100 : 0;
  const inactivePct = totalVoters > 0 ? (inactiveVoters / totalVoters) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Exportable reports for auditing and post-election documentation.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Voted vs Inactive</div>
            <p className="mt-1 text-xs text-neutral-600">
              Based on submitted ballots (<span className="font-mono">ballots.is_submitted = true</span>).
            </p>
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

