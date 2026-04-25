import Link from "next/link";
import { notFound } from "next/navigation";
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

type ChoiceRow = {
  id: string;
  geo_group_id: number;
  candidate_id: string;
  created_at: string;
  candidate_full_name: string | null;
  candidate_photo_url: string | null;
  geo_group_code: string | null;
  geo_group_name: string | null;
};

export default async function AdminBallotDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ballotId = String(id || "").trim();
  if (!ballotId) notFound();

  const supabase = createSupabaseServiceRoleClient();

  const [{ data: ballot, error: bErr }, { data: choices, error: cErr }] = await Promise.all([
    supabase
      .from("ballots")
      .select("id, voter_id, session_id, confcode, is_submitted, submitted_at, created_at")
      .eq("id", ballotId)
      .maybeSingle(),
    supabase
      .from("ballot_choices")
      .select(
        `
        id,
        geo_group_id,
        candidate_id,
        created_at,
        candidates:candidate_id ( full_name, photo_url ),
        geo_groups:geo_group_id ( code, name )
      `,
      )
      .eq("ballot_id", ballotId)
      .order("created_at", { ascending: true }),
  ]);

  if (bErr || cErr) {
    // eslint-disable-next-line no-console
    console.error("ballot details load failed", { bErr, cErr });
    const { message } = toPublicMessage(bErr ?? cErr, "Unable to load ballot details.");
    throw new Error(message);
  }
  if (!ballot) notFound();

  const b = ballot as BallotRow;

  const rows: ChoiceRow[] = (choices ?? []).map((r: any) => ({
    id: String(r.id),
    geo_group_id: Number(r.geo_group_id),
    candidate_id: String(r.candidate_id),
    created_at: String(r.created_at ?? ""),
    candidate_full_name: r.candidates?.full_name ?? null,
    candidate_photo_url: r.candidates?.photo_url ?? null,
    geo_group_code: r.geo_groups?.code ?? null,
    geo_group_name: r.geo_groups?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <UrlToasts />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Ballot</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Ballot ID <span className="font-mono text-xs">{b.id}</span>
            </p>
          </div>
          <Link className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50" href="/admin/ballots">
            Back
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-600">Confcode</div>
            <div className="mt-1 font-mono text-xs">{b.confcode ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-600">Voter</div>
            <div className="mt-1 font-mono text-xs">{b.voter_id ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-600">Submitted</div>
            <div className="mt-1 text-sm font-semibold">{b.is_submitted ? "Yes" : "No"}</div>
            <div className="mt-1 text-xs text-neutral-600">
              {b.submitted_at ? new Date(b.submitted_at).toLocaleString() : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Ballot choices</div>
        <div className="admin-table-wrap mt-3">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Geo group</th>
                <th>Candidate</th>
                <th>Chosen at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-neutral-800">
                    <div className="font-mono text-xs">{r.geo_group_code ?? r.geo_group_id}</div>
                    <div className="text-xs text-neutral-600">{r.geo_group_name ?? ""}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      {r.candidate_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.candidate_photo_url}
                          alt=""
                          className="h-9 w-9 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-md border bg-neutral-50" />
                      )}
                      <div>
                        <div>{r.candidate_full_name ?? r.candidate_id}</div>
                        <div className="font-mono text-xs text-neutral-600">{r.candidate_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-neutral-600">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td className="admin-table-empty" colSpan={3}>
                    No choices recorded for this ballot.
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

