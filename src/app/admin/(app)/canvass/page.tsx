import Link from "next/link";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";
import {
  buildCanvassReportModel,
  getCanvassReportHeaderDataUrl,
  renderCanvassReportHtml,
} from "@/lib/admin/canvass-report";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { getAppSettingsStatus } from "@/lib/admin/app-settings-status";
import { isSystemSuperSession } from "@/lib/admin/admin-roles";
import { getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { CanvassUnlockPreview } from "./canvass-unlock-preview";
import { CanvassTabsNav, type CanvassTabKey } from "./canvass-tabs-nav";
import { AdminResultsReport } from "../results/admin-results-report";
import { BallotsTab } from "./ballots-tab";

function parseTab(raw: string | string[] | undefined): CanvassTabKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "results" || v === "ballots") return v;
  return "canvass";
}

export default async function AdminCanvassPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const status = await getAppSettingsStatus();
  const isClosed = status === "closed";
  const canViewReport = isClosed;

  const session = await getAdminSession();
  const isSuper = isSystemSuperSession(session);

  let adminUsername = "";
  if (session && isSuper) {
    const supabase = createSupabaseServiceRoleClient();
    const { data: row, error } = await supabase
      .from("admin_users")
      .select("username")
      .eq("id", session.admin_user_id)
      .maybeSingle();
    if (error) {
      console.error("canvass admin username load failed", error);
      const { message } = toPublicMessage(error, "Unable to load admin profile.");
      throw new Error(message);
    }
    adminUsername = String((row as { username?: string | null } | null)?.username ?? "").trim();
  }

  let activeConfcode: string | null = null;
  let tabContent: React.ReactNode = null;

  if (tab === "results") {
    const initial = await getAdminResultsPayload();
    activeConfcode = initial.activeConfcode ?? null;
    tabContent = <AdminResultsReport initial={initial} />;
  } else if (tab === "ballots") {
    tabContent = <BallotsTab />;
    const supabase = createSupabaseServiceRoleClient();
    const { data: row } = await supabase
      .from("app_settings")
      .select("active_confcode")
      .eq("id", 1)
      .maybeSingle();
    const raw = (row as { active_confcode?: string | null } | null)?.active_confcode;
    activeConfcode = raw && String(raw).trim() ? String(raw).trim() : null;
  } else {
    // Canvass report tab (default)
    const payload = await getAdminResultsPayload();
    activeConfcode = payload.activeConfcode ?? null;
    const model =
      activeConfcode != null && String(activeConfcode).trim() !== ""
        ? buildCanvassReportModel(payload)
        : null;
    const headerDataUrl = model ? await getCanvassReportHeaderDataUrl() : null;
    tabContent = model ? (
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-0 shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="text-sm font-semibold">Preview</div>
          <div className="mt-1 text-xs text-neutral-600">
            This preview matches the PDF output.
            {!canViewReport ? (
              <>
                {" "}
                <span className="text-neutral-800">
                  The live preview is blurred until voting status is{" "}
                  <span className="font-mono">closed</span>.
                </span>
              </>
            ) : null}
          </div>
        </div>
        <iframe
          title="Canvass report preview"
          className="h-[75vh] w-full rounded-b-2xl"
          srcDoc={renderCanvassReportHtml(model, { headerDataUrl })}
        />
      </div>
    ) : (
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Canvass</h2>
        <p className="mt-3 text-sm text-neutral-700">
          No active conference is set. Choose a confcode in{" "}
          <Link href="/admin/settings/conference" className="underline">
            Settings
          </Link>{" "}
          to generate a canvass report.
        </p>
      </div>
    );
  }

  const previewLocked = !canViewReport;
  const isCanvassTab = tab === "canvass";

  return (
    <div className="space-y-6">
      <UrlToasts />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Canvass</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Results, ballots, and the official canvass report for the active conference. All
              sections are locked until voting status is{" "}
              <span className="font-mono">closed</span>.
            </p>
          </div>
          {isCanvassTab ? (
            <div className="flex flex-wrap gap-2">
              {canViewReport ? (
                <Link
                  href="/admin/canvass/pdf"
                  className="rounded-md bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"
                >
                  Download PDF
                </Link>
              ) : (
                <span
                  className="rounded-md bg-neutral-200 px-3 py-2 text-sm text-neutral-600"
                  title="Canvass is locked until voting status is closed."
                >
                  Download PDF (locked)
                </span>
              )}
            </div>
          ) : null}
        </div>

        {activeConfcode ? (
          <p className="mt-2 text-xs text-neutral-600">
            Active confcode: <span className="font-mono">{activeConfcode}</span>
          </p>
        ) : null}
      </div>

      <CanvassTabsNav activeTab={tab} />

      <CanvassUnlockPreview
        locked={previewLocked}
        showUnlock={previewLocked && isSuper}
        adminUsername={adminUsername}
        electionStatusLabel={status ?? "—"}
        returnTab={tab}
      >
        {tabContent}
      </CanvassUnlockPreview>
    </div>
  );
}
