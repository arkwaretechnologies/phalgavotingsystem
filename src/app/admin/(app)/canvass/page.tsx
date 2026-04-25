import Link from "next/link";
import { getAdminResultsPayload } from "@/lib/admin/results-tallies";
import { buildCanvassReportModel, renderCanvassReportHtml } from "@/lib/admin/canvass-report";
import { UrlToasts } from "@/app/_components/UrlToasts";

export default async function AdminCanvassPage() {
  const payload = await getAdminResultsPayload();
  const model = buildCanvassReportModel(payload);

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
            <Link
              href="/admin/canvass/pdf"
              className="rounded-md bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Download PDF
            </Link>
          </div>
        </div>

        {!payload.activeConfcode ? (
          <div className="mt-4 text-sm text-neutral-700">
            No active conference is set. Choose a confcode in{" "}
            <Link href="/admin/settings" className="underline">
              Settings
            </Link>{" "}
            to generate a canvass report.
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-600">
            Active confcode: <span className="font-mono">{payload.activeConfcode}</span>
          </p>
        )}
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
            srcDoc={renderCanvassReportHtml(model)}
          />
        </div>
      ) : null}
    </div>
  );
}

