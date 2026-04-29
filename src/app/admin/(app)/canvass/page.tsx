import Link from "next/link";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";
import {
  buildCanvassReportModel,
  getCanvassReportHeaderDataUrl,
  renderCanvassReportHtml,
} from "@/lib/admin/canvass-report";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { getAppSettingsStatus } from "@/lib/admin/app-settings-status";
import { hasFinalTallyGrant } from "@/lib/admin/final-tally-grant";
import { FinalTallyForm } from "./final-tally-form";

export default async function AdminCanvassPage() {
  const status = await getAppSettingsStatus();
  const isClosed = status === "closed";
  const unlocked = await hasFinalTallyGrant();
  const canViewReport = isClosed || unlocked;

  const payload = await getAdminResultsPayload();
  const model = canViewReport ? buildCanvassReportModel(payload) : null;
  const headerDataUrl = model ? await getCanvassReportHeaderDataUrl() : null;

  return (
    <div className="space-y-6">
      <UrlToasts />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Canvass</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Generate the official canvass report for the active conference and export it as PDF.
            </p>
          </div>
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
                title="Final tally is locked until the election is closed (or a super admin unlocks it)."
              >
                Download PDF (locked)
              </span>
            )}
          </div>
        </div>

        {!payload.activeConfcode ? (
          <div className="mt-4 text-sm text-neutral-700">
            No active conference is set. Choose a confcode in{" "}
            <Link href="/admin/settings/conference" className="underline">
              Settings
            </Link>{" "}
            to generate a canvass report.
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-600">
            Active confcode: <span className="font-mono">{payload.activeConfcode}</span>
          </p>
        )}

        {!canViewReport ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Canvass report is locked while the election status is not closed.
            <div className="mt-1 text-xs text-amber-900/80">
              Current status: <span className="font-mono">{status ?? "—"}</span>
            </div>
            <FinalTallyForm />
          </div>
        ) : null}
      </div>

      {model ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-0 shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="text-sm font-semibold">Preview</div>
            <div className="mt-1 text-xs text-neutral-600">
              This preview matches the PDF output.
            </div>
          </div>
          <iframe
            title="Canvass report preview"
            className="h-[75vh] w-full rounded-b-2xl"
            srcDoc={renderCanvassReportHtml(model, { headerDataUrl })}
          />
        </div>
      ) : null}
    </div>
  );
}

