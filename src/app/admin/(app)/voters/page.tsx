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

  const supabase = createSupabaseServiceRoleClient();
  const { count, error } = await supabase.from("voters").select("id", { count: "exact", head: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("load voters count failed", error);
    const { message } = toPublicMessage(error, "Unable to load voters right now.");
    throw new Error(message);
  }

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["imported", "skipped"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Voters</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Import the official voter list via CSV. Rows are inserted into{" "}
          <span className="font-mono">public.voters</span>.
        </p>
        <div className="mt-3 text-xs text-neutral-600">
          Current voters in database: <span className="font-mono">{count ?? 0}</span>
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
    </div>
  );
}

