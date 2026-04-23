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
  const { data: tablets, error } = await supabase
    .from("tablets")
    .select("id, label, status, current_session, last_active_at, created_at")
    .order("id", { ascending: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("load tablets failed", error);
    throw new Error("Unable to load tablets right now.");
  }

  const selected = activeTabletId ? (tablets ?? []).find((t) => t.id === activeTabletId) ?? null : null;

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["tablet"]} />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Tablets</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Pair physical devices to tablet records and monitor their status.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
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

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="border-b px-2 py-2 font-medium">Label</th>
                <th className="border-b px-2 py-2 font-medium">Status</th>
                <th className="border-b px-2 py-2 font-medium">Session</th>
                <th className="border-b px-2 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {(tablets ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="border-b px-2 py-2">{t.label}</td>
                  <td className="border-b px-2 py-2">{t.status}</td>
                  <td className="border-b px-2 py-2 font-mono text-xs">{t.current_session ?? "—"}</td>
                  <td className="border-b px-2 py-2">
                    <a
                      className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                      href={`/admin/tablets/${t.id}`}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {(tablets ?? []).length === 0 ? (
                <tr>
                  <td className="px-2 py-6 text-sm text-neutral-500" colSpan={4}>
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

