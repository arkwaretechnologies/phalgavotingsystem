import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkInVoter } from "./actions";
import { toPublicMessage } from "@/lib/errors/public-message";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { ThermalReceiptPrintActions } from "./thermal-receipt-print";

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

  const supabase = createSupabaseServiceRoleClient();

  let voters: VoterRow[] = [];
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
    voters = (data ?? []) as VoterRow[];
  }

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["checked_in", "voter_id", "queue", "token"]} />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Voter Check-in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Search the imported voter list, verify identity on-site, then generate a queue number +
          6-digit token (QR).
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
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
        <p className="mt-2 text-xs text-neutral-500">
          Tip: type at least 2 characters. Showing up to 25 matches.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Results</div>
        {checkedIn ? (
          <div className="mt-3 rounded-xl border bg-neutral-50 p-4">
            <div className="text-sm font-semibold">Check-in generated</div>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-neutral-500">Voter</div>
                <div className="font-mono text-xs">{checkedVoterId}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Queue #</div>
                <div className="font-mono text-lg">{checkedQueue || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Token</div>
                <div className="font-mono text-lg tracking-widest">{checkedToken || "—"}</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Next: display QR that encodes queue number + token for the voter.
            </p>

            {checkedQueue && checkedToken && checkedVoterId ? (
              <ThermalReceiptPrintActions queue={checkedQueue} token={checkedToken} voterId={checkedVoterId} />
            ) : null}
          </div>
        ) : null}
        {q.length < 2 ? (
          <p className="mt-2 text-sm text-neutral-600">Enter a search term to begin.</p>
        ) : voters.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No matching voters found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Position</th>
                  <th className="border-b px-2 py-2 font-medium">LGU / Province</th>
                  <th className="border-b px-2 py-2 font-medium">Email</th>
                  <th className="border-b px-2 py-2 font-medium">Phone</th>
                  <th className="border-b px-2 py-2 font-medium">Verified</th>
                  <th className="border-b px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {voters.map((v) => (
                  <tr key={v.id} className="hover:bg-neutral-50">
                    <td className="border-b px-2 py-2">{v.full_name}</td>
                    <td className="border-b px-2 py-2 text-neutral-600">{v.position ?? "—"}</td>
                    <td className="border-b px-2 py-2 text-neutral-600">
                      {v.lgu ?? "—"}
                      {v.province ? ` / ${v.province}` : ""}
                    </td>
                    <td className="border-b px-2 py-2 text-neutral-600">{v.email ?? "—"}</td>
                    <td className="border-b px-2 py-2 text-neutral-600">{v.phone ?? "—"}</td>
                    <td className="border-b px-2 py-2">{v.is_verified ? "Yes" : "No"}</td>
                    <td className="border-b px-2 py-2">
                      <form action={checkInVoter}>
                        <input type="hidden" name="voter_id" value={v.id} />
                        <input type="hidden" name="q" value={q} />
                        <button
                          type="submit"
                          className="rounded-md bg-black px-2 py-1 text-xs text-white hover:bg-neutral-800"
                        >
                          Check-in
                        </button>
                      </form>
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

