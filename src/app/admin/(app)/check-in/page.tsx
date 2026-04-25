import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkInVoter } from "./actions";
import { toPublicMessage } from "@/lib/errors/public-message";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { ThermalReceiptPrintActions } from "./thermal-receipt-print";
import { redirect } from "next/navigation";

type VoterRow = {
  id: string;
  full_name: string;
  position: string | null;
  lgu: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
  is_verified: boolean | null;
};

type SessionBrief = {
  voter_id: string | null;
  status: string | null;
  queue_number: number | null;
};

export default async function AdminCheckInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (qRaw ?? "").trim();
  const checkedIn = (Array.isArray(sp.checked_in) ? sp.checked_in[0] : sp.checked_in) === "1";
  const checkedVoterId = String(Array.isArray(sp.voter_id) ? sp.voter_id[0] : sp.voter_id ?? "");
  const checkedQueue = String(Array.isArray(sp.queue) ? sp.queue[0] : sp.queue ?? "");
  const checkedToken = String(Array.isArray(sp.token) ? sp.token[0] : sp.token ?? "");
  const showForVoterId = String(
    Array.isArray(sp.show_voter_id) ? sp.show_voter_id[0] : sp.show_voter_id ?? "",
  ).trim();

  const supabase = createSupabaseServiceRoleClient();

  // "Show Queue No" path: load latest active session for voter and render the same panel.
  let showQueue = "";
  let showToken = "";
  if (!checkedIn && showForVoterId) {
    const { data: sRow, error: sErr } = await supabase
      .from("voting_sessions")
      .select("queue_number, token, status, session_end, created_at")
      .eq("voter_id", showForVoterId)
      .maybeSingle();

    if (sErr) {
      // eslint-disable-next-line no-console
      console.error("load voter session for show queue failed", sErr);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("toast", "error");
      params.set("message", "Unable to load queue info. Please try again.");
      redirect(`/admin/check-in?${params.toString()}`);
    } else if (!sRow) {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("toast", "error");
      params.set("message", "No active queue found for this voter.");
      redirect(`/admin/check-in?${params.toString()}`);
    } else if (sRow.status === "queued" || sRow.status === "voting") {
      showQueue = String(sRow.queue_number ?? "");
      showToken = String(sRow.token ?? "");
      if (!showQueue || !showToken) {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        params.set("toast", "error");
        params.set("message", "Queue info is incomplete for this voter.");
        redirect(`/admin/check-in?${params.toString()}`);
      }
    } else if (sRow.status === "voted") {
      const whenRaw = (sRow.session_end ?? sRow.created_at) as string | null;
      const whenText = whenRaw ? new Date(whenRaw).toLocaleString() : "unknown time";
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("toast", "error");
      params.set(
        "message",
        `Voter already voted (Queue #${sRow.queue_number ?? "—"}) at ${whenText}.`,
      );
      redirect(`/admin/check-in?${params.toString()}`);
    } else {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("toast", "info");
      params.set(
        "message",
        `No active queue for this voter (status: ${String(sRow.status ?? "unknown")}).`,
      );
      redirect(`/admin/check-in?${params.toString()}`);
    }
  }

  let voters: VoterRow[] = [];
  let sessionByVoterId = new Map<string, SessionBrief>();
  if (q.length >= 2) {
    // OR across fields using PostgREST `or` filter
    const or = [
      `full_name.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `phone.ilike.%${q}%`,
    ].join(",");

    const { data, error } = await supabase
      .from("voters")
      .select("id, full_name, position, lgu, province, email, phone, is_verified")
      .or(or)
      .order("full_name", { ascending: true })
      .limit(25);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("check-in search failed", error);
      const { message } = toPublicMessage(error, "Unable to search voters right now.");
      throw new Error(message);
    }
    voters = (data ?? []) as unknown as VoterRow[];

    // Load latest session status for these voters (for Status column + button disable).
    const voterIds = voters.map((v) => v.id).filter(Boolean);
    if (voterIds.length) {
      const { data: sessions, error: sErr } = await supabase
        .from("voting_sessions")
        .select("voter_id, status, queue_number")
        .in("voter_id", voterIds);

      if (sErr) {
        // eslint-disable-next-line no-console
        console.error("load voting_sessions for check-in list failed", sErr);
      } else {
        sessionByVoterId = new Map<string, SessionBrief>();
        for (const s of (sessions ?? []) as SessionBrief[]) {
          const vid = s.voter_id ? String(s.voter_id) : null;
          if (!vid) continue;
          // If multiple sessions exist, prefer the one with highest queue_number.
          const prev = sessionByVoterId.get(vid);
          const prevQ = prev?.queue_number ?? -1;
          const curQ = s.queue_number ?? -1;
          if (!prev || curQ > prevQ) sessionByVoterId.set(vid, s);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["checked_in", "voter_id", "queue", "token"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Voter Check-in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Search the imported voter list, verify identity on-site, then generate a queue number +
          6-digit token (QR).
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Search</div>
        <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]" action="/admin/check-in">
          <input
            name="q"
            defaultValue={q}
            className="w-full rounded-md border px-3 py-2"
            placeholder="Search by full name / email / phone…"
          />
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
            Search
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-600">
          Tip: type at least 2 characters. Showing up to 25 matches.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Results</div>
        {checkedIn || (showForVoterId && showQueue && showToken) ? (
          <div className="mt-3 rounded-xl border bg-neutral-50 p-4">
            <div className="text-sm font-semibold">Check-in generated</div>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-neutral-600">Voter</div>
                <div className="font-mono text-xs">{checkedIn ? checkedVoterId : showForVoterId}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Queue #</div>
                <div className="font-mono text-lg">{(checkedIn ? checkedQueue : showQueue) || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Token</div>
                <div className="font-mono text-lg tracking-widest">{(checkedIn ? checkedToken : showToken) || "—"}</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              Next: display QR that encodes queue number + token for the voter.
            </p>

            {(checkedIn ? checkedQueue && checkedToken && checkedVoterId : showQueue && showToken && showForVoterId) ? (
              <ThermalReceiptPrintActions
                queue={checkedIn ? checkedQueue : showQueue}
                token={checkedIn ? checkedToken : showToken}
                voterId={checkedIn ? checkedVoterId : showForVoterId}
              />
            ) : null}
          </div>
        ) : null}
        {q.length < 2 ? (
          <p className="mt-2 text-sm text-neutral-600">Enter a search term to begin.</p>
        ) : voters.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No matching voters found.</p>
        ) : (
          <div className="admin-table-wrap mt-4">
            <table className="admin-table admin-table--checkin">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Position</th>
                  <th>LGU / Province</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((v) => {
                  const params = new URLSearchParams();
                  if (q) params.set("q", q);
                  params.set("show_voter_id", v.id);
                  const showUrl = `/admin/check-in?${params.toString()}`;
                  const session = sessionByVoterId.get(v.id) ?? null;
                  const isVoted = (session?.status ?? "").toLowerCase() === "voted";

                  return (
                    <tr key={v.id}>
                      <td className="font-medium text-neutral-900">{v.full_name}</td>
                      <td className="text-neutral-600">{v.position ?? "—"}</td>
                      <td className="text-neutral-600">
                        {v.lgu ?? "—"}
                        {v.province ? ` / ${v.province}` : ""}
                      </td>
                      <td className="text-neutral-600">{v.email ?? "—"}</td>
                      <td className="text-neutral-600">{v.phone ?? "—"}</td>
                      <td>{v.is_verified ? "Yes" : "No"}</td>
                      <td className="text-neutral-600">{session?.status ?? "—"}</td>
                      <td className="text-right">
                        {isVoted ? (
                          <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700">
                            Vote Casted
                          </span>
                        ) : v.is_verified ? (
                          <a
                            href={showUrl}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                          >
                            Show Queue No
                          </a>
                        ) : (
                          <form action={checkInVoter} className="inline">
                            <input type="hidden" name="voter_id" value={v.id} />
                            <input type="hidden" name="q" value={q} />
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                            >
                              Check-in
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

