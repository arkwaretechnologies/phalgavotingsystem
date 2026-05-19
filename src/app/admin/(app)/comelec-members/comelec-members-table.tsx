"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  deleteComelecMember,
  updateComelecMember,
} from "@/app/admin/comelec-members/actions";

export type ComelecMemberRow = {
  id: string;
  name: string | null;
  position: string | null;
  lgu: string | null;
  province: string | null;
  confcode: string | null;
  photo_url: string | null;
  created_at: string;
};

export function ComelecMembersTable({
  members,
  activeConfcode,
}: {
  members: ComelecMemberRow[];
  activeConfcode: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirm");
  const [confirmMessage, setConfirmMessage] = useState("");
  const confirmActionRef = useRef<null | (() => void)>(null);

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
        <div className="ph-brand-scrim fixed inset-0 z-50 grid place-items-center p-4">
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
                className="ph-brand-button rounded-md px-3 py-2 text-sm"
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
            <th>Position</th>
            <th>LGU</th>
            <th>Province</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isEditing = editingId === m.id;
            const displayName = m.name ?? "—";

            if (!isEditing) {
              return (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {m.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.photo_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#facc15]/40 bg-[#0a0820] px-0.5 text-center text-[7px] font-bold leading-tight tracking-wide text-[#facc15]">
                          COMELEC
                        </div>
                      )}
                      <div>{displayName}</div>
                    </div>
                  </td>
                  <td className="text-neutral-600">{m.position ?? "—"}</td>
                  <td className="text-neutral-600">{m.lgu ?? "—"}</td>
                  <td className="text-neutral-600">{m.province ?? "—"}</td>
                  <td className="text-neutral-600">{new Date(m.created_at).toLocaleString()}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/comelec-members/${encodeURIComponent(m.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                        title="Open member profile in a new tab"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                        onClick={() => setEditingId(m.id)}
                      >
                        Edit
                      </button>
                      <form action={deleteComelecMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="button"
                          className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            const form = (e.currentTarget as HTMLButtonElement).form;
                            if (!form) return;
                            openConfirm({
                              title: "Delete COMELEC member",
                              message: `Delete "${displayName}"? This cannot be undone.`,
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
              <tr key={m.id} className="admin-table-edit-row">
                <td colSpan={6}>
                  <form action={updateComelecMember} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="confcode" value={activeConfcode ?? ""} />
                    <div className="sm:col-span-2 lg:col-span-4">
                      <div className="text-xs text-neutral-600">Current photo</div>
                      <div className="mt-2 flex items-center gap-3">
                        {m.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.photo_url}
                            alt={`${displayName} photo`}
                            className="h-16 w-16 rounded-lg border object-cover"
                          />
                        ) : (
                          <div className="grid h-16 w-16 place-items-center rounded-lg border bg-neutral-50 text-[9px] font-bold text-neutral-500">
                            COMELEC
                          </div>
                        )}
                        <div className="text-xs text-neutral-600">
                          Uploading a new file replaces the stored photo.
                        </div>
                      </div>
                      <label className="mt-2 block">
                        <span className="text-xs text-neutral-600">New photo (optional)</span>
                        <input
                          name="photo_file"
                          type="file"
                          accept="image/*"
                          className="mt-1 block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                        />
                      </label>
                    </div>
                    <label className="block sm:col-span-2">
                      <span className="text-xs text-neutral-600">Name</span>
                      <input
                        name="name"
                        defaultValue={m.name ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-neutral-600">Position</span>
                      <input
                        name="position"
                        defaultValue={m.position ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-neutral-600">LGU</span>
                      <input
                        name="lgu"
                        defaultValue={m.lgu ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-neutral-600">Province</span>
                      <input
                        name="province"
                        defaultValue={m.province ?? ""}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
                      <button
                        type="submit"
                        className="ph-brand-button rounded-md px-3 py-2 text-sm"
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
          {members.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-2 py-8 text-center text-sm text-neutral-500">
                No COMELEC members yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
