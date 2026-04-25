import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { importVotersCsv } from "../../voters/actions";
import { toPublicMessage } from "@/lib/errors/public-message";
import { UrlToasts } from "@/app/_components/UrlToasts";

export default async function AdminVotersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const imported = Number(Array.isArray(sp.imported) ? sp.imported[0] : sp.imported) || 0;
  const skipped = Number(Array.isArray(sp.skipped) ? sp.skipped[0] : sp.skipped) || 0;
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = String(qRaw ?? "").trim();
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const pageSize = 20;

  const supabase = createSupabaseServiceRoleClient();
  const base = supabase.from("voters").select("id", { count: "exact", head: true });
  const { count, error } =
    q.length >= 2
      ? await base.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      : await base;
  if (error) {
    // eslint-disable-next-line no-console
    console.error("load voters count failed", error);
    const { message } = toPublicMessage(error, "Unable to load voters right now.");
    throw new Error(message);
  }

  const total = Number(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  let rows:
    | Array<{
        id: string;
        full_name: string;
        position: string | null;
        lgu: string | null;
        province: string | null;
        email: string | null;
        phone: string | null;
      }>
    | null = null;

  if (total > 0) {
    const query = supabase
      .from("voters")
      .select("id, full_name, position, lgu, province, email, phone")
      .order("full_name", { ascending: true })
      .range(from, to);

    const { data, error: listErr } =
      q.length >= 2
        ? await query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        : await query;

    if (listErr) {
      // eslint-disable-next-line no-console
      console.error("load voters list failed", listErr);
      const { message } = toPublicMessage(listErr, "Unable to load voters right now.");
      throw new Error(message);
    }
    rows = data ?? [];
  }

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/admin/voters?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["imported", "skipped", "toast", "message"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Voters</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Import the official voter list via CSV. You can also add, edit, and delete voters below.
            </p>
            <div className="mt-3 text-xs text-neutral-600">
              Current voters in database: <span className="font-mono">{count ?? 0}</span>
            </div>
          </div>
          <a href="/admin/voters/new" className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800">
            Add voter
          </a>
        </div>
      </div>

      {imported || skipped ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 text-sm shadow-sm">
          Imported <span className="font-semibold">{imported}</span> rows. Skipped{" "}
          <span className="font-semibold">{skipped}</span> rows (missing full_name).
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">CSV import</div>
            <p className="mt-1 text-xs text-neutral-600">
              Required column: <span className="font-mono">full_name</span>. Other columns are optional.
            </p>
          </div>
          <a
            href="/admin/voters/template.csv"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Download CSV template
          </a>
        </div>

        <form action={importVotersCsv} className="mt-4 grid gap-3">
          <input
            name="csv"
            type="file"
            accept=".csv,text/csv"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <div className="flex justify-end">
            <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
              Import CSV
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Manage voters</div>
            <p className="mt-1 text-xs text-neutral-600">Sorted alphabetically. Search by name/email/phone.</p>
          </div>
          <form action="/admin/voters" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              className="h-9 w-64 max-w-full rounded-md border px-3 text-sm"
              placeholder="Search…"
            />
            <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-neutral-50">
              Search
            </button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="border-b px-2 py-2 font-medium">Name</th>
                <th className="border-b px-2 py-2 font-medium">Position</th>
                <th className="border-b px-2 py-2 font-medium">LGU / Province</th>
                <th className="border-b px-2 py-2 font-medium">Email</th>
                <th className="border-b px-2 py-2 font-medium">Phone</th>
                <th className="border-b px-2 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {(rows ?? []).map((v) => (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="border-b px-2 py-2">{v.full_name}</td>
                  <td className="border-b px-2 py-2 text-neutral-600">{v.position ?? "—"}</td>
                  <td className="border-b px-2 py-2 text-neutral-600">
                    {v.lgu ?? "—"}
                    {v.province ? ` / ${v.province}` : ""}
                  </td>
                  <td className="border-b px-2 py-2 text-neutral-600">{v.email ?? "—"}</td>
                  <td className="border-b px-2 py-2 text-neutral-600">{v.phone ?? "—"}</td>
                  <td className="border-b px-2 py-2 text-right">
                    <a
                      href={`/admin/voters/${v.id}`}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-xs font-medium hover:bg-neutral-50"
                    >
                      Edit / Delete
                    </a>
                  </td>
                </tr>
              ))}
              {total === 0 ? (
                <tr>
                  <td className="px-2 py-8 text-sm text-neutral-500" colSpan={6}>
                    No voters found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-xs text-neutral-500">
            Showing <span className="font-mono">{Math.min(from + 1, total)}</span>–<span className="font-mono">{Math.min(to + 1, total)}</span> of{" "}
            <span className="font-mono">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={pageHref(Math.max(1, safePage - 1))}
              className={`rounded-md border px-3 py-2 text-xs hover:bg-neutral-50 ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Prev
            </a>
            <div className="text-xs text-neutral-600">
              Page <span className="font-mono">{safePage}</span> / <span className="font-mono">{totalPages}</span>
            </div>
            <a
              href={pageHref(Math.min(totalPages, safePage + 1))}
              className={`rounded-md border px-3 py-2 text-xs hover:bg-neutral-50 ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              Next
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

