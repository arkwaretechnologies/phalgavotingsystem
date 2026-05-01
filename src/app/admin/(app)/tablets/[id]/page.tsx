import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import QRCode from "@/app/admin/tablets/qr";
import { createPairCodeForTablet } from "@/app/admin/tablets/pair-actions";
import { TabletEditor } from "../tablet-editor";
import { UnpairCard } from "./unpair-card";
import { toPublicMessage } from "@/lib/errors/public-message";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { AutoRefreshOnPair } from "./auto-refresh-on-pair";

export const dynamic = "force-dynamic";

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

  const [{ data: tablet, error: tErr }, { data: queue, error: qErr }, { data: pairing, error: pErr }] =
    await Promise.all([
    supabase
      .from("tablets")
      .select("id, label, status, current_session, last_active_at, created_at")
      .eq("id", tabletId)
      .maybeSingle(),
    supabase
      .from("voting_sessions")
      .select("id, queue_number, status, tablet_id")
      .in("status", ["queued", "voting"])
      // Hide skipped queued voters from the tablet detail's queue preview.
      .or("status.eq.voting,skipped_at.is.null")
      .order("queue_number", { ascending: true })
      .limit(20),
    supabase
      .from("tablet_pairings")
      .select("claimed_by_device_id, claimed_at, revoked_at")
      .eq("tablet_id", tabletId)
      .not("claimed_at", "is", null)
      .is("revoked_at", null)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (tErr || qErr || pErr) {
    // eslint-disable-next-line no-console
    console.error("tablet details load failed", { tErr, qErr, pErr });
    const { message } = toPublicMessage(tErr ?? qErr ?? pErr, "Unable to load tablet details right now.");
    throw new Error(message);
  }
  if (!tablet) notFound();

  const pairedDeviceId = pairing?.claimed_by_device_id ? String(pairing.claimed_by_device_id) : null;

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["code"]} />
      <AutoRefreshOnPair enabled={!pairedDeviceId} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
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
            <div className="text-xs text-neutral-600">Status</div>
            <div className="mt-1 text-sm font-semibold">{tablet.status ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-600">Current session</div>
            <div className="mt-1 font-mono text-xs">{tablet.current_session ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-600">Last active</div>
            <div className="mt-1 text-sm">
              {tablet.last_active_at ? new Date(tablet.last_active_at).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      <TabletEditor id={tablet.id} label={tablet.label} status={tablet.status} />

      {pairedDeviceId ? <UnpairCard tabletId={tablet.id} pairedDeviceId={pairedDeviceId} /> : null}

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Pair device</div>
        <p className="mt-2 text-xs text-neutral-600">
          Generate a pairing code/QR, then on the device open <span className="font-mono">/tablet/pair</span>.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <form action={createPairCodeForTablet} className="space-y-2">
            <input type="hidden" name="tablet_id" value={String(tablet.id)} />
            <input type="hidden" name="return_to" value={`/admin/tablets/${tablet.id}`} />
            <button
              type="submit"
              className="ph-brand-button rounded-md px-3 py-2 text-sm disabled:opacity-50"
              disabled={Boolean(pairedDeviceId)}
              title={pairedDeviceId ? "Unpair this tablet first" : undefined}
            >
              Generate pairing code
            </button>
            {pairedDeviceId ? (
              <p className="text-xs text-neutral-600">
                Pairing is locked while a device is paired. Unpair first to generate a new code.
              </p>
            ) : null}
          </form>

          {code ? (
            <div className="rounded-xl border p-4">
              <div className="text-xs text-neutral-600">Pairing code</div>
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

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Queue (top 20)</div>
        <div className="admin-table-wrap mt-3">
          <table className="admin-table admin-table--tight">
            <thead>
              <tr>
                <th>Queue #</th>
                <th>Status</th>
                <th>Tablet</th>
              </tr>
            </thead>
            <tbody>
              {(queue ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="tabular-nums font-medium">{s.queue_number}</td>
                  <td>{s.status ?? "—"}</td>
                  <td className="tabular-nums">{s.tablet_id ?? "—"}</td>
                </tr>
              ))}
              {(queue ?? []).length === 0 ? (
                <tr>
                  <td className="admin-table-empty" colSpan={3}>
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

