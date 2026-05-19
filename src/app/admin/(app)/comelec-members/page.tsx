import Link from "next/link";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createComelecMember } from "../../comelec-members/actions";
import {
  ComelecMembersTable,
  type ComelecMemberRow,
} from "./comelec-members-table";
import { toPublicMessage } from "@/lib/errors/public-message";

const fieldInputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-[var(--ph-flag-blue)]/15";
const fileInputClass =
  "mt-1.5 block w-full text-sm text-neutral-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-200/90";

export default async function AdminComelecMembersPage() {
  const supabase = createSupabaseServiceRoleClient();

  const { data: settings, error: settingsErr } = await supabase
    .from("app_settings")
    .select("id, active_confcode")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    console.error("admin comelec members settings load failed", settingsErr);
    const { message } = toPublicMessage(settingsErr, "Unable to load COMELEC members page.");
    throw new Error(message);
  }

  const activeConfcode = settings?.active_confcode ? String(settings.active_confcode) : null;

  const membersQuery = supabase
    .from("comelec_members")
    .select(
      "id, name, position, comelec_position, sort_order, lgu, province, confcode, photo_url, created_at",
    )
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(50);

  const { data: members, error: membersErr } = activeConfcode
    ? await membersQuery.eq("confcode", activeConfcode)
    : await membersQuery;

  if (membersErr) {
    console.error("admin comelec members list failed", membersErr);
    const { message } = toPublicMessage(membersErr, "Unable to load COMELEC members list.");
    throw new Error(message);
  }

  const rows: ComelecMemberRow[] = (members ?? []).map((m) => ({
    id: String(m.id),
    name: m.name ?? null,
    position: m.position ?? null,
    comelec_position: m.comelec_position ?? null,
    sort_order: m.sort_order == null ? null : Number(m.sort_order),
    lgu: m.lgu ?? null,
    province: m.province ?? null,
    confcode: m.confcode ?? null,
    photo_url: m.photo_url ?? null,
    created_at: String(m.created_at),
  }));

  return (
    <div className="space-y-5">
      <UrlToasts />
      <div className="rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">COMELEC Members</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Manage COMELEC members for the active conference. View profiles and download a presentation PDF.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0 sm:shrink-0">
          {activeConfcode ? (
            <a
              href="/api/admin/comelec-members-presentation"
              className="ph-brand-button inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold"
              title="Download a PDF with one page per COMELEC member"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-3.5 w-3.5"
              >
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Download presentation
            </a>
          ) : null}
          {activeConfcode ? (
            <div>
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
              className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100/90"
            >
              Set conference in Settings →
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Add COMELEC member</h2>

        <form action={createComelecMember} className="mt-5 space-y-5">
          <input type="hidden" name="confcode" value={activeConfcode ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Name</span>
              <input
                name="name"
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
              >
                {activeConfcode ?? "No active confcode"}
              </div>
            </div>
          </div>

          <label className="block min-w-0 sm:max-w-md">
            <span className="text-sm font-medium text-neutral-800">Photo</span>
            <input name="photo_file" type="file" accept="image/*" className={fileInputClass} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">COMELEC position</span>
              <input
                name="comelec_position"
                className={fieldInputClass}
                placeholder="e.g. Chairperson"
              />
              <span className="mt-1 block text-[11px] text-neutral-500">
                Shown under the photo on profile and presentation slides.
              </span>
            </label>
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Sort order</span>
              <input
                name="sort_order"
                type="number"
                className={fieldInputClass}
                placeholder="e.g. 1"
                inputMode="numeric"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">Position</span>
              <input name="position" className={fieldInputClass} placeholder="Optional" />
            </label>
            <label className="block min-w-0">
              <span className="text-sm font-medium text-neutral-800">LGU</span>
              <input name="lgu" className={fieldInputClass} placeholder="Optional" />
            </label>
            <label className="block min-w-0 sm:col-span-2 lg:col-span-1">
              <span className="text-sm font-medium text-neutral-800">Province</span>
              <input name="province" className={fieldInputClass} placeholder="Optional" />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-center text-[11px] text-neutral-500 sm:mr-auto sm:text-left">
              {!activeConfcode ? "Set an active conference before adding members." : "Name is required."}
            </p>
            <button
              type="submit"
              disabled={!activeConfcode}
              className="ph-brand-button h-10 rounded-lg px-5 text-sm font-medium disabled:opacity-45"
            >
              Add member
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Recent members</h2>
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

        <ComelecMembersTable members={rows} activeConfcode={activeConfcode} />
      </div>
    </div>
  );
}
