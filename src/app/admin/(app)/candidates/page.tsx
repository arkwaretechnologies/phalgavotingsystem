import Link from "next/link";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createCandidate } from "../../candidates/actions";
import { CandidatesTable, type CandidateRow, type GeoGroupRow } from "./candidates-table";
import { toPublicMessage } from "@/lib/errors/public-message";

const fieldInputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10";
const fieldSelectClass =
  "mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10";
const fileInputClass =
  "mt-1.5 block w-full text-sm text-neutral-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-200/90";
const fieldTextareaClass =
  "mt-1.5 min-h-[5.5rem] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10";

const fieldTextareaShortClass =
  "mt-1.5 min-h-[3.25rem] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10";

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

  if (geoErr || settingsErr) {
    // eslint-disable-next-line no-console
    console.error("admin candidates load failed", { geoErr, settingsErr });
    const { message } = toPublicMessage(geoErr ?? settingsErr, "Unable to load candidates page.");
    throw new Error(message);
  }

  const activeConfcode = settings?.active_confcode ? String(settings.active_confcode) : null;
  const geoList = geoGroups ?? [];
  const hasGeoGroups = geoList.length > 0;
  const candidatesQuery = supabase
    .from("candidates")
    .select(
      "id, full_name, geo_group_id, is_active, created_at, confcode, photo_url, bio, gender, civil_status, date_of_birth, post_office_address, present_position, lgu_address, highest_educational_attainment, provincial_league",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: candidates, error: candErr } = activeConfcode
    ? await candidatesQuery.eq("confcode", activeConfcode)
    : await candidatesQuery;
  if (candErr) {
    // eslint-disable-next-line no-console
    console.error("admin candidates list failed", candErr);
    const { message } = toPublicMessage(candErr, "Unable to load candidates list.");
    throw new Error(message);
  }

  const candidateIds = (candidates ?? []).map((c) => String((c as { id?: string }).id ?? "")).filter(Boolean);
  const [{ data: phalgaLines, error: phErr }, { data: provLines, error: provErr }] =
    candidateIds.length > 0
      ? await Promise.all([
          supabase
            .from("candidates_prev_curr_phalga")
            .select("id, linenum, position, period_covered")
            .in("id", candidateIds)
            .order("id", { ascending: true })
            .order("linenum", { ascending: true }),
          supabase
            .from("candidates_prev_curr_provincial_league")
            .select("id, linenum, position, period_covered")
            .in("id", candidateIds)
            .order("id", { ascending: true })
            .order("linenum", { ascending: true }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (phErr || provErr) {
    // eslint-disable-next-line no-console
    console.error("admin candidates prev/curr load failed", { phErr, provErr });
  }

  const phalgaById: Record<string, Array<{ position: string | null; period_covered: string | null }>> =
    {};
  for (const row of (phalgaLines ?? []) as Array<{
    id: string;
    linenum: number;
    position: string | null;
    period_covered: string | null;
  }>) {
    const id = String(row.id);
    if (!phalgaById[id]) phalgaById[id] = [];
    phalgaById[id].push({ position: row.position ?? null, period_covered: row.period_covered ?? null });
  }

  const provincialById: Record<string, Array<{ position: string | null; period_covered: string | null }>> =
    {};
  for (const row of (provLines ?? []) as Array<{
    id: string;
    linenum: number;
    position: string | null;
    period_covered: string | null;
  }>) {
    const id = String(row.id);
    if (!provincialById[id]) provincialById[id] = [];
    provincialById[id].push({ position: row.position ?? null, period_covered: row.period_covered ?? null });
  }

  return (
    <div className="space-y-5">
      <UrlToasts />
      <div className="rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Candidates</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Add people to the ballot and assign a geo group for the active conference.
          </p>
        </div>
        {activeConfcode ? (
          <div className="mt-3 shrink-0 sm:mt-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Active confcode
            </p>
            <p className="mt-0.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-sm text-neutral-900">
              {activeConfcode}
            </p>
          </div>
        ) : (
          <Link
            href="/admin/settings/conference"
            className="mt-3 inline-flex shrink-0 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100/90 sm:mt-0"
          >
            Set conference in Settings →
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Add candidate</h2>

        <form action={createCandidate} className="mt-5 space-y-5">
          <input type="hidden" name="confcode" value={activeConfcode ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Full name</span>
              <input
                name="full_name"
                className={fieldInputClass}
                placeholder="e.g. Juan Dela Cruz"
                required
                autoComplete="name"
              />
            </label>

            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-neutral-800">Conference (read-only)</span>
              <div
                className={`mt-1.5 flex h-10 items-center rounded-lg border px-3 font-mono text-sm ${
                  activeConfcode
                    ? "border-neutral-200 bg-neutral-50 text-neutral-900"
                    : "border-amber-200/80 bg-amber-50/50 text-amber-950"
                }`}
                title="From Admin → Settings"
              >
                {activeConfcode ?? "No active confcode"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end sm:gap-5">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Geo group</span>
              <select
                name="geo_group_id"
                className={fieldSelectClass}
                required
                disabled={!activeConfcode || !hasGeoGroups}
                defaultValue=""
              >
                <option value="" disabled>
                  {hasGeoGroups ? "Select geo group…" : "No geo groups defined"}
                </option>
                {geoList.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.code} — {g.name}
                    {!g.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
              {!hasGeoGroups ? (
                <p className="mt-1 text-[11px] text-amber-800">
                  Add active geo groups in the database before candidates can be assigned.
                </p>
              ) : null}
            </label>

            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-neutral-200/80 bg-neutral-50/40 px-3 py-2 transition hover:bg-neutral-50 sm:mb-0">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked
                className="h-4 w-4 rounded border-neutral-300 text-[#050203] focus:ring-[#050203]/20"
              />
              <span className="text-sm font-medium text-neutral-800">Visible on ballot (active)</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Photo</span>
              <input name="photo_file" type="file" accept="image/*" className={fileInputClass} />
            </label>

            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Bio</span>
              <textarea
                name="bio"
                rows={3}
                className={fieldTextareaClass}
                placeholder="Optional short description"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
            <div className="text-sm font-semibold text-neutral-900">Candidate Information</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-5">
              <label className="block min-w-0">
                <span className="text-sm font-medium text-neutral-800">Gender</span>
                <select name="gender" className={fieldSelectClass} defaultValue="">
                  <option value="">Select…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-medium text-neutral-800">Civil status</span>
                <select name="civil_status" className={fieldSelectClass} defaultValue="">
                  <option value="">Select…</option>
                  <option value="S">Single</option>
                  <option value="M">Married</option>
                  <option value="W">Widowed</option>
                </select>
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-medium text-neutral-800">Date of birth</span>
                <input name="date_of_birth" type="date" className={fieldInputClass} />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-medium text-neutral-800">Highest educational attainment</span>
                <input
                  name="highest_educational_attainment"
                  className={fieldInputClass}
                  placeholder=""
                />
              </label>

              <label className="block min-w-0 sm:col-span-2">
                <span className="text-sm font-medium text-neutral-800">
                  Post office address (for election purposes)
                </span>
                <textarea
                  name="post_office_address"
                  rows={2}
                  className={fieldTextareaShortClass}
                  placeholder=""
                />
              </label>

              <label className="block min-w-0 sm:col-span-2">
                <span className="text-sm font-medium text-neutral-800">Present position in the LGU</span>
                <select name="present_position" className={fieldSelectClass} defaultValue="">
                  <option value="">Select…</option>
                  <option value="PROVINCIAL ACCOUNTANT">PROVINCIAL ACCOUNTANT</option>
                  <option value="CITY ACCOUNTANT">CITY ACCOUNTANT</option>
                  <option value="MUNICIPAL ACCOUNTANT">MUNICIPAL ACCOUNTANT</option>
                </select>
              </label>

              <label className="block min-w-0 sm:col-span-2">
                <span className="text-sm font-medium text-neutral-800">LGU Address</span>
                <textarea
                  name="lgu_address"
                  rows={2}
                  className={fieldTextareaShortClass}
                  placeholder=""
                />
              </label>

              <label className="block min-w-0 sm:col-span-2">
                <span className="text-sm font-medium text-neutral-800">Provincial Association address</span>
                <textarea
                  name="provincial_league"
                  rows={2}
                  className={fieldTextareaShortClass}
                  placeholder=""
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-800">
                  Previous / Current positions in PhALGA
                </div>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={`phalga-${idx}`} className="grid gap-2 sm:grid-cols-2">
                      <input
                        name={`phalga_position_${idx + 1}`}
                        className={fieldInputClass}
                        placeholder={`Position ${idx + 1}`}
                      />
                      <input
                        name={`phalga_period_${idx + 1}`}
                        className={fieldInputClass}
                        placeholder={`Period covered ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-800">
                  Previous / Current positions in Provincial Association
                </div>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={`prov-${idx}`} className="grid gap-2 sm:grid-cols-2">
                      <input
                        name={`prov_position_${idx + 1}`}
                        className={fieldInputClass}
                        placeholder={`Position ${idx + 1}`}
                      />
                      <input
                        name={`prov_period_${idx + 1}`}
                        className={fieldInputClass}
                        placeholder={`Period covered ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-center text-[11px] text-neutral-500 sm:mr-auto sm:text-left">
              {!activeConfcode
                ? "Set an active conference before adding candidates."
                : !hasGeoGroups
                  ? "Define at least one geo group before adding candidates."
                  : "Full name and geo group are required."}
            </p>
            <button
              type="submit"
              disabled={!activeConfcode || !hasGeoGroups}
              className="h-10 rounded-lg bg-[#050203] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Add candidate
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Recent candidates</h2>
        <div className="mt-0.5 text-xs text-neutral-600">
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
          candidates={(candidates ?? []) as unknown as CandidateRow[]}
          geoGroups={geoList as unknown as GeoGroupRow[]}
          activeConfcode={activeConfcode}
          prevCurrPhalgaById={phalgaById}
          prevCurrProvincialById={provincialById}
        />
      </div>
    </div>
  );
}

