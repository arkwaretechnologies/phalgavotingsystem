import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createPairCodeForTablet } from "../../tablets/pair-actions";
import { createTablet } from "../../tablets/tablet-actions";
import QRCode from "../../tablets/qr";
import { UrlToasts } from "@/app/_components/UrlToasts";

export default async function AdminTabletsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const activeTabletIdRaw = Array.isArray(sp.tablet) ? sp.tablet[0] : sp.tablet;
  const activeTabletId = activeTabletIdRaw ? Number(activeTabletIdRaw) : null;

  const supabase = createSupabaseServiceRoleClient();
  const [{ data: tablets, error }, { data: pairings, error: pErr }] = await Promise.all([
    supabase
      .from("tablets")
      .select("id, label, status, current_session, last_active_at, created_at")
      .order("id", { ascending: true }),
    supabase
      .from("tablet_pairings")
      .select("tablet_id, claimed_by_device_id, claimed_at, revoked_at")
      .not("claimed_at", "is", null)
      .is("revoked_at", null),
  ]);

  if (error || pErr) {
    // eslint-disable-next-line no-console
    console.error("load tablets failed", { error, pErr });
    throw new Error("Unable to load tablets right now.");
  }

  const pairedByTabletId = new Map<number, string>();
  for (const r of (pairings ?? []) as Array<{
    tablet_id: number;
    claimed_by_device_id: string | null;
  }>) {
    if (r.tablet_id && r.claimed_by_device_id) {
      pairedByTabletId.set(Number(r.tablet_id), String(r.claimed_by_device_id));
    }
  }

  const selected = activeTabletId ? (tablets ?? []).find((t) => t.id === activeTabletId) ?? null : null;

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["tablet"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Tablets</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Pair physical devices to tablet records and monitor their status.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="text-sm font-semibold">Status board</div>
          <form action={createTablet} className="flex items-center gap-2">
            <input
              name="label"
              className="h-9 w-44 rounded-md border px-3 text-sm"
              placeholder="New tablet label"
              required
            />
            <button type="submit" className="h-9 rounded-md bg-black px-3 text-sm text-white">
              Add tablet
            </button>
          </form>
        </div>

        <div className="admin-table-wrap mt-3">
          <table className="admin-table admin-table--tight">
            <thead>
              <tr>
                <th>Label</th>
                <th>Status</th>
                <th>Session</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {(tablets ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.label}</td>
                  <td>{pairedByTabletId.has(t.id) ? t.status : "offline"}</td>
                  <td className="font-mono text-xs">{t.current_session ?? "—"}</td>
                  <td>
                    {pairedByTabletId.has(t.id) ? (
                      <a
                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                        href={`/admin/tablets/${t.id}`}
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(tablets ?? []).length === 0 ? (
                <tr>
                  <td className="admin-table-empty" colSpan={4}>
                    No tablets found.
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

