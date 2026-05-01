import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { OpenQueueDisplayButton } from "./open-queue-display-button";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { skipCurrentQueue, recallSkippedQueue } from "./actions";
import { SkipCurrentForm, RecallSkippedForm } from "./queueing-controls";

type VoterBrief = {
  id: string;
  full_name: string;
  position: string | null;
  lgu: string | null;
  province: string | null;
  is_verified: boolean | null;
};

type SessionRow = {
  id: string;
  queue_number: number;
  status: string | null;
  created_at: string;
  voter_id: string | null;
  skipped_at: string | null;
};

export default async function AdminQueueingPage() {
  const supabase = createSupabaseServiceRoleClient();

  let sessions: SessionRow[] | null = null;
  let sErr: { message?: string } | null = null;
  try {
    sessions = await fetchAllRows<SessionRow>(async (from, to) =>
      await supabase
        .from("voting_sessions")
        .select("id, queue_number, status, created_at, voter_id, skipped_at")
        .eq("status", "queued")
        .order("queue_number", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch (e) {
    sErr = { message: String((e as any)?.message ?? e) };
  }

  if (sErr) {
    // eslint-disable-next-line no-console
    console.error("queueing load sessions failed", sErr);
    const { message } = toPublicMessage(sErr, "Unable to load the queue right now.");
    throw new Error(message);
  }

  const sessionList = (sessions ?? []) as SessionRow[];
  const voterIds = [...new Set(sessionList.map((s) => s.voter_id).filter((id): id is string => Boolean(id)))];

  let voterMap = new Map<string, VoterBrief>();
  if (voterIds.length > 0) {
    const { data: voters, error: vErr } = await supabase
      .from("voters")
      .select("id, full_name, position, lgu, province, is_verified")
      .in("id", voterIds)
      .eq("is_verified", true);

    if (vErr) {
      // eslint-disable-next-line no-console
      console.error("queueing load voters failed", vErr);
      const { message } = toPublicMessage(vErr, "Unable to load voter details for the queue.");
      throw new Error(message);
    }

    voterMap = new Map((voters ?? []).map((v) => [v.id, v as VoterBrief]));
  }

  const allRows = sessionList
    .map((s) => {
      if (!s.voter_id) return null;
      const voter = voterMap.get(s.voter_id);
      if (!voter) return null;
      return { session: s, voter };
    })
    .filter((r): r is { session: SessionRow; voter: VoterBrief } => r !== null);

  const activeRows = allRows.filter((r) => !r.session.skipped_at);
  const skippedRows = allRows
    .filter((r) => Boolean(r.session.skipped_at))
    .sort((a, b) => {
      const at = a.session.skipped_at ? Date.parse(a.session.skipped_at) : 0;
      const bt = b.session.skipped_at ? Date.parse(b.session.skipped_at) : 0;
      return bt - at;
    });

  const nowServing = activeRows[0] ?? null;

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["toast", "message", "error"]} />

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Queueing</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Verified voters waiting in line with an active <span className="font-mono">queued</span> session,
              ordered by queue number.
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Showing <span className="font-semibold">{activeRows.length}</span> in queue
              {skippedRows.length > 0 ? (
                <>
                  {" • "}
                  <span className="font-semibold">{skippedRows.length}</span> skipped
                </>
              ) : null}
            </p>
          </div>
          <OpenQueueDisplayButton />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Now serving</p>
            {nowServing ? (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-3xl font-bold tabular-nums text-neutral-900">
                  #{nowServing.session.queue_number}
                </span>
                <span className="truncate text-sm text-neutral-600">{nowServing.voter.full_name}</span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-neutral-600">No one is currently being served.</p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              Use this if the next voter has stepped away. Skipping hides them from the queue display so the
              following number is called. They keep their queue # + token and can be re-called below.
            </p>
          </div>
          {nowServing ? (
            <SkipCurrentForm
              action={skipCurrentQueue}
              queueNumber={nowServing.session.queue_number}
            />
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-400"
            >
              Skip & call next
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        {activeRows.length === 0 ? (
          <p className="text-sm text-neutral-600">No verified voters are currently queued.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Queue #</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>LGU / Province</th>
                  <th>Checked in</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map(({ session, voter }) => (
                  <tr key={session.id}>
                    <td className="font-mono font-semibold tabular-nums">{session.queue_number}</td>
                    <td>{voter.full_name}</td>
                    <td className="text-neutral-600">{voter.position ?? "—"}</td>
                    <td className="text-neutral-600">
                      {voter.lgu ?? "—"}
                      {voter.province ? ` / ${voter.province}` : ""}
                    </td>
                    <td className="text-neutral-600">
                      {session.created_at
                        ? new Date(session.created_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {skippedRows.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-amber-900">Skipped</h2>
            <p className="text-xs text-amber-900/80">
              These voters were skipped but still hold their queue # + token. Re-call them when they return; their
              number will appear back on the queue display.
            </p>
          </div>
          <div className="admin-table-wrap mt-4">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Queue #</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>LGU / Province</th>
                  <th>Skipped at</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {skippedRows.map(({ session, voter }) => (
                  <tr key={session.id}>
                    <td className="font-mono font-semibold tabular-nums">{session.queue_number}</td>
                    <td>{voter.full_name}</td>
                    <td className="text-neutral-600">{voter.position ?? "—"}</td>
                    <td className="text-neutral-600">
                      {voter.lgu ?? "—"}
                      {voter.province ? ` / ${voter.province}` : ""}
                    </td>
                    <td className="text-neutral-600">
                      {session.skipped_at
                        ? new Date(session.skipped_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="text-right">
                      <RecallSkippedForm
                        action={recallSkippedQueue}
                        sessionId={session.id}
                        queueNumber={session.queue_number}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
