import Link from "next/link";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { UrlToasts } from "@/app/_components/UrlToasts";

type BallotRow = {
  id: string;
  voter_id: string | null;
  session_id: string | null;
  confcode: string | null;
  is_submitted: boolean | null;
  submitted_at: string | null;
  created_at: string;
};

export default async function AdminBallotsPage() {
  const supabase = createSupabaseServiceRoleClient();

  const { data: settingsRow, error: settingsErr } = await supabase
    .from("app_settings")
    .select("active_confcode")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    // eslint-disable-next-line no-console
    console.error("ballots settings load failed", settingsErr);
    const { message } = toPublicMessage(settingsErr, "Unable to load settings.");
    throw new Error(message);
  }

  const activeConfcodeRaw = (settingsRow as { active_confcode?: string | null } | null)?.active_confcode;
  const activeConfcode =
    activeConfcodeRaw != null && String(activeConfcodeRaw).trim() !== ""
      ? String(activeConfcodeRaw).trim()
      : null;

  if (!activeConfcode) {
    return (
      <div className="space-y-6">
        <UrlToasts />
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Ballots</h1>
          <p className="mt-2 text-sm text-neutral-600">
            No active conference is selected. Set <span className="font-mono">active_confcode</span> in Settings.
          </p>
          <div className="mt-4">
            <Link className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50" href="/admin/settings">
              Open Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: ballots, error } = await supabase
    .from("ballots")
    .select("id, voter_id, session_id, confcode, is_submitted, submitted_at, created_at")
    .eq("confcode", activeConfcode)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("ballots load failed", error);
    const { message } = toPublicMessage(error, "Unable to load ballots.");
    throw new Error(message);
  }

  const rows = (ballots ?? []) as BallotRow[];

  return (
    <div className="space-y-6">
      <UrlToasts />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Ballots</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Showing ballots for active confcode <span className="font-mono">{activeConfcode}</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Recent ballots</div>
        <div className="admin-table-wrap mt-3">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Ballot</th>
                <th>Voter</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="text-neutral-600">
                    {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="font-mono text-xs">{b.id}</td>
                  <td className="font-mono text-xs text-neutral-600">{b.voter_id ?? "—"}</td>
                  <td>
                    {b.is_submitted ? (
                      <div>
                        <div className="text-sm font-semibold">Yes</div>
                        <div className="text-xs text-neutral-600">
                          {b.submitted_at ? new Date(b.submitted_at).toLocaleString() : ""}
                        </div>
                      </div>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td>
                    <Link
                      className="inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                      href={`/admin/ballots/${b.id}`}
                    >
                      Open choices
                    </Link>
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td className="admin-table-empty" colSpan={5}>
                    No ballots found for this confcode.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

