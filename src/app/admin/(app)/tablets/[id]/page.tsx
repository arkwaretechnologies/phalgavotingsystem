import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import QRCode from "@/app/admin/tablets/qr";
import { createPairCodeForTablet } from "@/app/admin/tablets/pair-actions";

export default async function AdminTabletDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const tabletId = Number(id);
  if (!Number.isFinite(tabletId) || tabletId <= 0) notFound();

  const sp = (await searchParams) ?? {};
  const code = Array.isArray(sp.code) ? sp.code[0] : sp.code;

  const supabase = createSupabaseServiceRoleClient();

  const [{ data: tablet, error: tErr }, { data: queue, error: qErr }] = await Promise.all([
    supabase
      .from("tablets")
      .select("id, label, status, current_session, last_active_at, created_at")
      .eq("id", tabletId)
      .maybeSingle(),
    supabase
      .from("voting_sessions")
      .select("id, queue_number, status, tablet_id")
      .in("status", ["queued", "voting"])
      .order("queue_number", { ascending: true })
      .limit(20),
  ]);

  if (tErr) throw new Error(tErr.message);
  if (qErr) throw new Error(qErr.message);
  if (!tablet) notFound();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Tablet details</h1>
            <p className="mt-1 text-sm text-neutral-600">
              ID {tablet.id} • {tablet.label}
            </p>
          </div>
          <a
            href="/admin/tablets"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Back
          </a>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-500">Status</div>
            <div className="mt-1 text-sm font-semibold">{tablet.status ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-500">Current session</div>
            <div className="mt-1 font-mono text-xs">{tablet.current_session ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-500">Last active</div>
            <div className="mt-1 text-sm">
              {tablet.last_active_at ? new Date(tablet.last_active_at).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Pair device</div>
        <p className="mt-2 text-xs text-neutral-500">
          Generate a pairing code/QR, then on the device open <span className="font-mono">/tablet/pair</span>.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <form action={createPairCodeForTablet} className="space-y-2">
            <input type="hidden" name="tablet_id" value={String(tablet.id)} />
            <input type="hidden" name="return_to" value={`/admin/tablets/${tablet.id}`} />
            <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white">
              Generate pairing code
            </button>
          </form>

          {code ? (
            <div className="rounded-xl border p-4">
              <div className="text-xs text-neutral-500">Pairing code</div>
              <div className="mt-1 font-mono text-2xl">{String(code)}</div>
              <div className="mt-3 grid place-items-center">
                <QRCode value={JSON.stringify({ pair_code: String(code) })} />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-4 text-sm text-neutral-600">
              No code generated yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Queue (top 20)</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="border-b px-2 py-2 font-medium">Queue #</th>
                <th className="border-b px-2 py-2 font-medium">Status</th>
                <th className="border-b px-2 py-2 font-medium">Tablet</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {(queue ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50">
                  <td className="border-b px-2 py-2">{s.queue_number}</td>
                  <td className="border-b px-2 py-2">{s.status ?? "—"}</td>
                  <td className="border-b px-2 py-2">{s.tablet_id ?? "—"}</td>
                </tr>
              ))}
              {(queue ?? []).length === 0 ? (
                <tr>
                  <td className="px-2 py-6 text-sm text-neutral-500" colSpan={3}>
                    No active queue.
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

