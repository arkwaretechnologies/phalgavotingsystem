import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createCandidate } from "../../candidates/actions";

export default async function AdminCandidatesPage() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: geoGroups, error: geoErr }, { data: candidates, error: candErr }, { data: conferences, error: confErr }] =
    await Promise.all([
      supabase
        .from("geo_groups")
        .select("id, code, name, is_active")
        .order("sort_order", { ascending: true }),
      supabase
        .from("candidates")
        .select("id, full_name, geo_group_id, is_active, created_at, confcode, photo_url")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("conference")
        .select("confcode, name")
        .eq("is_anc", "Y")
        .order("name", { ascending: true }),
    ]);

  if (geoErr) throw new Error(geoErr.message);
  if (candErr) throw new Error(candErr.message);
  if (confErr) throw new Error(confErr.message);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Candidates</h1>
        <p className="mt-2 text-sm text-neutral-600">Add candidates and assign them to a geo group.</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Add candidate</div>

        <form action={createCandidate} className="mt-4 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Full name</span>
              <input
                name="full_name"
                className="mt-1 w-full rounded-md border px-3 py-2"
                placeholder="e.g. Juan Dela Cruz"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Conference (confcode)</span>
              <select
                name="confcode"
                className="mt-1 w-full rounded-md border px-3 py-2"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select conference…
                </option>
                {(conferences ?? []).map((c) => (
                  <option key={c.confcode} value={c.confcode}>
                    {c.confcode}
                    {c.name ? ` — ${c.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Geo group</span>
              <select name="geo_group_id" className="mt-1 w-full rounded-md border px-3 py-2">
                <option value="null">(Unassigned)</option>
                {(geoGroups ?? []).map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.code} — {g.name}
                    {!g.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-end gap-2">
              <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4" />
              <span className="text-sm">Active</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Photo (upload)</span>
              <input
                name="photo_file"
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
              <div className="mt-1 text-xs text-neutral-500">
                Uploaded to bucket <span className="font-mono">candidate</span>, URL saved to{" "}
                <span className="font-mono">candidates.photo_url</span>.
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Bio</span>
              <input
                name="bio"
                className="mt-1 w-full rounded-md border px-3 py-2"
                placeholder="Short description (optional)"
              />
            </label>
          </div>

          <div className="flex items-center justify-end">
            <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
              Add candidate
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Recent candidates</div>
        <div className="mt-1 text-xs text-neutral-500">Showing latest 50</div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="border-b px-2 py-2 font-medium">Name</th>
                <th className="border-b px-2 py-2 font-medium">Geo group</th>
                <th className="border-b px-2 py-2 font-medium">Confcode</th>
                <th className="border-b px-2 py-2 font-medium">Active</th>
                <th className="border-b px-2 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {(candidates ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="border-b px-2 py-2">{c.full_name}</td>
                  <td className="border-b px-2 py-2 text-neutral-600">{c.geo_group_id ?? "—"}</td>
                  <td className="border-b px-2 py-2 font-mono text-xs">{c.confcode}</td>
                  <td className="border-b px-2 py-2">{c.is_active ? "Yes" : "No"}</td>
                  <td className="border-b px-2 py-2 text-neutral-600">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(candidates ?? []).length === 0 ? (
                <tr>
                  <td className="px-2 py-6 text-sm text-neutral-500" colSpan={5}>
                    No candidates yet.
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

