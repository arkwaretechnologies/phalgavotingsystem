"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { deleteCandidate, updateCandidate } from "@/app/admin/candidates/actions";

export type CandidateRow = {
  id: string;
  full_name: string;
  geo_group_id: number | null;
  is_active: boolean | null;
  created_at: string;
  confcode: string;
  photo_url: string | null;
  bio?: string | null;
  gender?: string | null;
  civil_status?: string | null;
  date_of_birth?: string | null;
  post_office_address?: string | null;
  present_position?: string | null;
  highest_educational_attainment?: string | null;
  provincial_league?: string | null;
};

export type GeoGroupRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean | null;
};

export function CandidatesTable({
  candidates,
  geoGroups,
  activeConfcode,
}: {
  candidates: CandidateRow[];
  geoGroups: GeoGroupRow[];
  activeConfcode: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState<string>("Confirm");
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const confirmActionRef = useRef<null | (() => void)>(null);

  const geoOptions = useMemo(() => geoGroups ?? [], [geoGroups]);
  const geoById = useMemo(() => {
    const map = new Map<number, GeoGroupRow>();
    for (const g of geoOptions) map.set(g.id, g);
    return map;
  }, [geoOptions]);

  function openConfirm(opts: { title: string; message: string; onConfirm: () => void }) {
    setConfirmTitle(opts.title);
    setConfirmMessage(opts.message);
    confirmActionRef.current = opts.onConfirm;
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    confirmActionRef.current = null;
  }

  return (
    <div className="admin-table-wrap mt-4">
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold">{confirmTitle}</div>
            <div className="mt-2 text-sm text-neutral-600">{confirmMessage}</div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={closeConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-black px-3 py-2 text-sm text-white"
                onClick={() => {
                  const fn = confirmActionRef.current;
                  closeConfirm();
                  fn?.();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Geo group</th>
            <th>Active</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const isEditing = editingId === c.id;

            if (!isEditing) {
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.photo_url}
                          alt=""
                          className="h-9 w-9 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-md border bg-neutral-50" />
                      )}
                      <div>{c.full_name}</div>
                    </div>
                  </td>
                  <td className="text-neutral-600">
                    {c.geo_group_id != null ? geoById.get(c.geo_group_id)?.code ?? "—" : "—"}
                  </td>
                  <td>{c.is_active ? "Yes" : "No"}</td>
                  <td className="text-neutral-600">{new Date(c.created_at).toLocaleString()}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/candidates/${encodeURIComponent(c.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                        title="Open candidate profile in a new tab"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                        onClick={() => setEditingId(c.id)}
                      >
                        Edit
                      </button>
                      <form action={deleteCandidate}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="button"
                          className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            const form = (e.currentTarget as HTMLButtonElement).form;
                            if (!form) return;
                            openConfirm({
                              title: "Delete candidate",
                              message: `Delete candidate "${c.full_name}"? This cannot be undone.`,
                              onConfirm: () => form.requestSubmit(),
                            });
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={c.id} className="admin-table-edit-row">
                <td colSpan={5}>
                  <form
                    action={updateCandidate}
                    className="grid gap-3 sm:grid-cols-5"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="confcode" value={activeConfcode ?? ""} />

                    <div className="sm:col-span-5">
                      <div className="text-xs text-neutral-600">Current photo</div>
                      <div className="mt-2 flex items-center gap-3">
                        {c.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.photo_url}
                            alt={`${c.full_name} photo`}
                            className="h-16 w-16 rounded-lg border object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg border bg-white" />
                        )}
                        <div className="text-xs text-neutral-600">
                          Uploading a new file will replace the stored URL in{" "}
                          <span className="font-mono">photo_url</span>.
                        </div>
                      </div>
                    </div>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-600">Full name</span>
                      <input
                        name="full_name"
                        defaultValue={c.full_name}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-neutral-600">Geo group</span>
                      <select
                        name="geo_group_id"
                        defaultValue={c.geo_group_id == null ? "" : String(c.geo_group_id)}
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10"
                        required
                        disabled={geoOptions.length === 0}
                      >
                        {c.geo_group_id == null ? (
                          <option value="" disabled>
                            {geoOptions.length ? "Select geo group…" : "No geo groups"}
                          </option>
                        ) : null}
                        {geoOptions.map((g) => (
                          <option key={g.id} value={String(g.id)}>
                            {g.code} — {g.name}
                            {!g.is_active ? " (inactive)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-end gap-2">
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={Boolean(c.is_active)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Active</span>
                    </label>

                    <label className="block sm:col-span-3">
                      <span className="text-xs text-neutral-600">Bio</span>
                      <input
                        name="bio"
                        defaultValue={c.bio ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder=""
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-neutral-600">Gender</span>
                      <select
                        name="gender"
                        defaultValue={c.gender ?? ""}
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10"
                      >
                        <option value="">Select…</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs text-neutral-600">Civil status</span>
                      <select
                        name="civil_status"
                        defaultValue={c.civil_status ?? ""}
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10"
                      >
                        <option value="">Select…</option>
                        <option value="S">Single</option>
                        <option value="M">Married</option>
                        <option value="W">Widowed</option>
                      </select>
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-600">Date of birth</span>
                      <input
                        type="date"
                        name="date_of_birth"
                        defaultValue={c.date_of_birth ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="block sm:col-span-3">
                      <span className="text-xs text-neutral-600">Post office address</span>
                      <input
                        name="post_office_address"
                        defaultValue={c.post_office_address ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder=""
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-600">Present position (LGU)</span>
                      <select
                        name="present_position"
                        defaultValue={c.present_position ?? ""}
                        className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-[#050203]/10"
                      >
                        <option value="">Select…</option>
                        <option value="PROVINCIAL ACCOUNTANT">PROVINCIAL ACCOUNTANT</option>
                        <option value="CITY ACCOUNTANT">CITY ACCOUNTANT</option>
                        <option value="MUNICIPAL ACCOUNTANT">MUNICIPAL ACCOUNTANT</option>
                      </select>
                    </label>

                    <label className="block sm:col-span-3">
                      <span className="text-xs text-neutral-600">Highest educational attainment</span>
                      <input
                        name="highest_educational_attainment"
                        defaultValue={c.highest_educational_attainment ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder=""
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-600">Provincial Association address</span>
                      <input
                        name="provincial_league"
                        defaultValue={c.provincial_league ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder=""
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-600">Replace photo</span>
                      <input
                        name="photo_file"
                        type="file"
                        accept="image/*"
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="flex flex-wrap items-end gap-2 sm:col-span-5">
                      <button
                        type="button"
                        className="rounded-md bg-black px-3 py-2 text-sm text-white"
                        onClick={(e) => {
                          const form = (e.currentTarget as HTMLButtonElement).form;
                          if (!form) return;
                          openConfirm({
                            title: "Save changes",
                            message: `Save changes to "${c.full_name}"?`,
                            onConfirm: () => form.requestSubmit(),
                          });
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            );
          })}

          {candidates.length === 0 ? (
            <tr>
              <td className="admin-table-empty" colSpan={5}>
                No candidates yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

