import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

type CandidateRow = {
  id: string;
  full_name: string;
};

export default async function CandidatesReportPage() {
  const supabase = createSupabaseServiceRoleClient();

  try {
    // Some deployments use `display_name` instead of `full_name`. Prefer `full_name`, then fallback.
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

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Candidates</h1>
              <p className="mt-2 text-sm text-neutral-600">
                List of candidate names. Export as PDF for printing.
              </p>
              <p className="mt-2 text-xs text-neutral-600">
                Total candidates: <span className="font-mono">{sorted.length}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/admin/reports/candidates/pdf"
                className="ph-brand-button rounded-lg px-4 py-2 text-sm font-medium"
              >
                Export PDF
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-0 shadow-sm">
          {sorted.length === 0 ? (
            <p className="p-6 text-sm text-neutral-600">No candidates found.</p>
          ) : (
            <div className="admin-table-wrap rounded-2xl shadow-none">
              <table className="admin-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "4rem" }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-right">No.</th>
                    <th className="text-left">Candidate</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="text-right tabular-nums text-neutral-600">{idx + 1}</td>
                      <td className="text-left font-medium text-neutral-900">{c.full_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("candidates report load failed", e);
    const { message } = toPublicMessage(e, "Unable to load candidates report right now.");
    throw new Error(message);
  }
}

