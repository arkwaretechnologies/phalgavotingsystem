"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";

export type NonParticipatingVoterRow = {
  id: string;
  full_name: string;
  position: string | null;
  lgu: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
};

function norm(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

export function NonParticipatingVotersClient({
  rows,
  generatedAtIso,
}: {
  rows: NonParticipatingVoterRow[];
  generatedAtIso: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.full_name,
        r.position,
        r.lgu,
        r.province,
        r.email,
        r.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, rows]);

  function exportCsv() {
    const csv = Papa.unparse(
      filtered.map((r, i) => ({
        no: i + 1,
        full_name: r.full_name,
        position: r.position ?? "",
        lgu: r.lgu ?? "",
        province: r.province ?? "",
        email: r.email ?? "",
        phone: r.phone ?? "",
      })),
      { quotes: true },
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inactive-voters_${new Date(generatedAtIso).toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPdfPrint() {
    const a = document.createElement("a");
    a.href = "/admin/reports/non-participating-voters/pdf";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Inactive Voters</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Voters with no submitted ballot (did not vote). Generated{" "}
              <span className="font-medium">{new Date(generatedAtIso).toLocaleString()}</span>.
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Showing <span className="font-mono">{filtered.length}</span> of{" "}
              <span className="font-mono">{rows.length}</span> voters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
              title="Exports a CSV that opens in Excel"
            >
              Export Excel (CSV)
            </button>
            <button
              type="button"
              onClick={exportPdfPrint}
              className="ph-brand-button rounded-lg px-4 py-2 text-sm font-medium"
              title="Downloads a PDF file"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-neutral-600">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-80 max-w-full rounded-md border border-neutral-200 px-3 text-sm"
              placeholder="Name / email / phone / location…"
            />
          </label>
          <div className="text-xs text-neutral-500">
            Tip: use Export after filtering to export just the filtered rows.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-600">No voters match your filter.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="text-right">No.</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>LGU / Province</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="text-right tabular-nums text-neutral-600">{idx + 1}</td>
                    <td className="font-medium text-neutral-900">{r.full_name}</td>
                    <td className="text-neutral-600">{norm(r.position)}</td>
                    <td className="text-neutral-600">
                      {norm(r.lgu)}
                      {r.province ? ` / ${r.province}` : ""}
                    </td>
                    <td className="text-neutral-600">{norm(r.email)}</td>
                    <td className="text-neutral-600">{norm(r.phone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

