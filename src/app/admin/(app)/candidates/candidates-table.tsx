"use client";

import { useMemo, useRef, useState } from "react";
import { deleteCandidate, updateCandidate } from "@/app/admin/candidates/actions";

type CandidateRow = {
  id: string;
  full_name: string;
  geo_group_id: number | null;
  is_active: boolean | null;
  created_at: string;
  confcode: string;
  photo_url: string | null;
  bio?: string | null;
};

type GeoGroupRow = {
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
    <div className="mt-4 overflow-x-auto">
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
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
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className="border-b px-2 py-2 font-medium">Name</th>
            <th className="border-b px-2 py-2 font-medium">Geo group</th>
            <th className="border-b px-2 py-2 font-medium">Active</th>
            <th className="border-b px-2 py-2 font-medium">Created</th>
            <th className="border-b px-2 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {candidates.map((c) => {
            const isEditing = editingId === c.id;

            if (!isEditing) {
              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="border-b px-2 py-2">
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
                  <td className="border-b px-2 py-2 text-neutral-600">{c.geo_group_id ?? "—"}</td>
                  <td className="border-b px-2 py-2">{c.is_active ? "Yes" : "No"}</td>
                  <td className="border-b px-2 py-2 text-neutral-600">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td className="border-b px-2 py-2">
                    <div className="flex flex-wrap gap-2">
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
              <tr key={c.id} className="bg-neutral-50/70">
                <td className="border-b px-2 py-2" colSpan={5}>
                  <form
                    action={updateCandidate}
                    className="grid gap-3 sm:grid-cols-5"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="confcode" value={activeConfcode ?? ""} />

                    <div className="sm:col-span-5">
                      <div className="text-xs text-neutral-500">Current photo</div>
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
                        <div className="text-xs text-neutral-500">
                          Uploading a new file will replace the stored URL in{" "}
                          <span className="font-mono">photo_url</span>.
                        </div>
                      </div>
                    </div>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-500">Full name</span>
                      <input
                        name="full_name"
                        defaultValue={c.full_name}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-neutral-500">Geo group</span>
                      <select
                        name="geo_group_id"
                        defaultValue={c.geo_group_id == null ? "null" : String(c.geo_group_id)}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      >
                        <option value="null">(Unassigned)</option>
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
                      <span className="text-xs text-neutral-500">Bio</span>
                      <input
                        name="bio"
                        defaultValue={c.bio ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder="(optional)"
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-500">Replace photo (optional)</span>
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
              <td className="px-2 py-6 text-sm text-neutral-500" colSpan={5}>
                No candidates yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

