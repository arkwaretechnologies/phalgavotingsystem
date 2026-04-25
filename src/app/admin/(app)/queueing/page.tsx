import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { OpenQueueDisplayButton } from "./open-queue-display-button";

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
};

export default async function AdminQueueingPage() {
  const supabase = createSupabaseServiceRoleClient();

  const { data: sessions, error: sErr } = await supabase
    .from("voting_sessions")
    .select("id, queue_number, status, created_at, voter_id")
    .eq("status", "queued")
    .order("queue_number", { ascending: true });

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

  const rows = sessionList
    .map((s) => {
      if (!s.voter_id) return null;
      const voter = voterMap.get(s.voter_id);
      if (!voter) return null;
      return { session: s, voter };
    })
    .filter((r): r is { session: SessionRow; voter: VoterBrief } => r !== null);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Queueing</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Verified voters waiting in line with an active <span className="font-mono">queued</span> session,
              ordered by queue number.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Showing <span className="font-semibold">{rows.length}</span> in queue
            </p>
          </div>
          <OpenQueueDisplayButton />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-600">No verified voters are currently queued.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="border-b px-2 py-2 font-medium">Queue #</th>
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Position</th>
                  <th className="border-b px-2 py-2 font-medium">LGU / Province</th>
                  <th className="border-b px-2 py-2 font-medium">Checked in</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rows.map(({ session, voter }) => (
                  <tr key={session.id} className="hover:bg-neutral-50">
                    <td className="border-b px-2 py-2 font-mono font-semibold">{session.queue_number}</td>
                    <td className="border-b px-2 py-2">{voter.full_name}</td>
                    <td className="border-b px-2 py-2 text-neutral-600">{voter.position ?? "—"}</td>
                    <td className="border-b px-2 py-2 text-neutral-600">
                      {voter.lgu ?? "—"}
                      {voter.province ? ` / ${voter.province}` : ""}
                    </td>
                    <td className="border-b px-2 py-2 text-neutral-600">
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
    </div>
  );
}
