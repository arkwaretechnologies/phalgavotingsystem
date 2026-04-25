import { UrlToasts } from "@/app/_components/UrlToasts";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { setActiveConfcode } from "@/app/admin/settings/actions";

export default async function AdminSettingsConferencePage() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: settings, error: settingsErr }, { data: conferences, error: confErr }] =
    await Promise.all([
      supabase
        .from("app_settings")
        .select("id, active_confcode, updated_at")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("conference")
        .select("confcode, name, date_from, date_to")
        .eq("is_anc", "Y")
        .order("date_from", {
          ascending: false,
        }),
    ]);

  if (settingsErr || confErr) {
    // eslint-disable-next-line no-console
    console.error("admin settings load failed", { settingsErr, confErr });
    const { message } = toPublicMessage(settingsErr ?? confErr, "Unable to load settings right now.");
    throw new Error(message);
  }

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["error"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Conference</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Select which conference is currently active for voting. Voter screens will only fetch
          candidates matching the selected <span className="font-mono">confcode</span>.
        </p>
        <form
          action={setActiveConfcode}
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="block flex-1">
            <span className="text-sm font-medium">Active confcode</span>
            <select
              name="active_confcode"
              defaultValue={settings?.active_confcode ?? "null"}
              className="mt-1 w-full rounded-md border px-3 py-2"
            >
              <option value="null">(No active conference)</option>
              {(conferences ?? []).map((c) => (
                <option key={c.confcode} value={c.confcode}>
                  {c.confcode}
                  {c.name ? ` — ${c.name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="h-10 rounded-md bg-black px-4 text-sm text-white">
            Save
          </button>
        </form>

        <div className="mt-3 text-xs text-neutral-600">
          Current: <span className="font-mono">{settings?.active_confcode ?? "(none)"}</span>
        </div>
      </div>
    </div>
  );
}
