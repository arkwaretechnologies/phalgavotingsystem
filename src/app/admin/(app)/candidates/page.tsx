import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createCandidate } from "../../candidates/actions";
import { CandidatesTable } from "./candidates-table";

export default async function AdminCandidatesPage() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: geoGroups, error: geoErr }, { data: settings, error: settingsErr }] =
    await Promise.all([
      supabase
        .from("geo_groups")
        .select("id, code, name, is_active")
        .order("sort_order", { ascending: true }),
      supabase
        .from("app_settings")
        .select("id, active_confcode")
        .eq("id", 1)
        .maybeSingle(),
    ]);

  if (geoErr) throw new Error(geoErr.message);
  if (settingsErr) throw new Error(settingsErr.message);

  const activeConfcode = settings?.active_confcode ? String(settings.active_confcode) : null;
  const candidatesQuery = supabase
    .from("candidates")
    .select("id, full_name, geo_group_id, is_active, created_at, confcode, photo_url, bio")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: candidates, error: candErr } = activeConfcode
    ? await candidatesQuery.eq("confcode", activeConfcode)
    : await candidatesQuery;
  if (candErr) throw new Error(candErr.message);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Candidates</h1>
        <p className="mt-2 text-sm text-neutral-600">Add candidates and assign them to a geo group.</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Add candidate</div>

        <form action={createCandidate} className="mt-4 grid gap-4">
          <input type="hidden" name="confcode" value={activeConfcode ?? ""} />
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

            <div className="rounded-md border bg-neutral-50 px-3 py-2">
              <div className="text-sm font-medium">Conference (confcode)</div>
              <div className="mt-1 font-mono text-sm">
                {activeConfcode ?? "No active confcode set (set it in Settings)"}
              </div>
            </div>
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
        <div className="mt-1 text-xs text-neutral-500">
          Showing latest 50
          {activeConfcode ? (
            <>
              {" "}
              for active confcode <span className="font-mono">{activeConfcode}</span>
            </>
          ) : (
            <> (no active confcode set)</>
          )}
        </div>

        <CandidatesTable
          candidates={(candidates ?? []) as any}
          geoGroups={(geoGroups ?? []) as any}
          activeConfcode={activeConfcode}
        />
      </div>
    </div>
  );
}

