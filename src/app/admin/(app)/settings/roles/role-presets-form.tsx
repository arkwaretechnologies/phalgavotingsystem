"use client";

import { useRef, useState } from "react";
import {
  createAdminRole,
  deleteAdminRole,
  resetAllRolePresetsToFullAccess,
  saveSingleRolePresets,
} from "@/app/admin/settings/role-preset-actions";
import {
  ADMIN_PAGE_KEY_ORDER,
  type AdminPageKey,
  adminPageKeyLabel,
} from "@/lib/admin/admin-page-keys";
import type { AdminRoleWithPreset } from "@/lib/admin/role-types";
import { SYSTEM_SUPER_SLUG } from "@/lib/admin/role-types";

function formatUpdatedAt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

type Props = { roles: AdminRoleWithPreset[]; loadDegraded: boolean };

function accessSummary(r: AdminRoleWithPreset) {
  if (r.is_full_access) return "All areas (full access)";
  const n = r.pageKeys.length;
  const total = ADMIN_PAGE_KEY_ORDER.length;
  return n >= total ? `All ${total} areas` : `${n} of ${total} areas`;
}

export function RolePresetsForm({ roles, loadDegraded }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  /** role id for permissions modal, or null */
  const [modalRoleId, setModalRoleId] = useState<number | null>(null);
  const modalFormRef = useRef<HTMLFormElement>(null);

  const editing = modalRoleId != null ? roles.find((x) => x.id === modalRoleId) : null;

  function setModalChecks(pick: (k: AdminPageKey) => boolean) {
    if (modalRoleId == null) return;
    const root = modalFormRef.current;
    if (!root) return;
    for (const k of ADMIN_PAGE_KEY_ORDER) {
      const el = root.querySelector<HTMLInputElement>(`input[name="preset__${modalRoleId}__${k}"]`);
      if (el) el.checked = pick(k);
    }
  }

  const canDelete = (r: AdminRoleWithPreset) =>
    !r.is_system && r.slug !== SYSTEM_SUPER_SLUG && !r.is_full_access;

  return (
    <div className="mt-6 space-y-8">
      {loadDegraded ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950"
        >
          <span className="font-semibold">Could not load roles from the database.</span> Check that
          migrations for <span className="font-mono">roles</span> and{" "}
          <span className="font-mono">role_pages</span> are applied, then refresh.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-600">
          Manage roles in the table, then use <span className="font-medium">Edit permissions</span> to
          choose areas for each non–full-access role.
        </p>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
        >
          Add role
        </button>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold">New role</div>
            <p className="mt-1 text-sm text-neutral-600">
              Slug is permanent (lowercase, letters, numbers, underscores). It is not shown to
              end-users.
            </p>
            <form action={createAdminRole} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium">Label</span>
                <input name="label" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. Front desk" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Slug</span>
                <input
                  name="slug"
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
                  pattern="[a-z0-9_]{2,64}"
                  placeholder="e.g. front_desk"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modalRoleId != null && editing != null && editing.is_full_access ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setModalRoleId(null)}
        >
          <div
            role="dialog"
            aria-labelledby="view-access-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="view-access-title" className="text-base font-semibold text-neutral-900">
              {editing.label}
            </div>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">{editing.slug}</p>
            <p className="mt-2 text-sm text-neutral-600">
              This role always has every admin area. The list below is what we store in the database
              for reference.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {ADMIN_PAGE_KEY_ORDER.map((k) => (
                <li
                  key={k}
                  className="rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700"
                >
                  {adminPageKeyLabel(k)}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                onClick={() => setModalRoleId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalRoleId != null && editing != null && !editing.is_full_access ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setModalRoleId(null)}
        >
          <div
            role="dialog"
            aria-labelledby="edit-perm-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="edit-perm-title" className="text-base font-semibold text-neutral-900">
              Edit permissions — {editing.label}
            </div>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">{editing.slug}</p>
            <p className="mt-2 text-sm text-neutral-600">At least one area must stay selected to save.</p>
            <form ref={modalFormRef} action={saveSingleRolePresets} className="mt-4 space-y-4">
              <input type="hidden" name="role_id" value={editing.id} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
                  onClick={() => setModalChecks(() => true)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
                  onClick={() => setModalChecks((k) => k === "dashboard")}
                >
                  Dashboard only
                </button>
              </div>
              <ul className="grid max-h-[min(50vh,22rem)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {ADMIN_PAGE_KEY_ORDER.map((k) => {
                  const allowed = new Set(editing.pageKeys);
                  return (
                    <li key={k}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                        <input
                          type="checkbox"
                          name={`preset__${editing.id}__${k}`}
                          value="1"
                          defaultChecked={allowed.has(k)}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                        <span>{adminPageKeyLabel(k)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  onClick={() => setModalRoleId(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Save permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="admin-table-wrap overflow-x-auto rounded-xl border border-neutral-200/90 bg-white shadow-sm">
        <table className="admin-table min-w-[36rem]">
          <thead>
            <tr>
              <th>Role</th>
              <th>Slug</th>
              <th>Page access</th>
              <th>Last updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900">{r.label}</span>
                    {r.is_system ? (
                      <span className="rounded bg-neutral-200/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-700">
                        System
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="font-mono text-sm text-neutral-600">{r.slug}</td>
                <td className="max-w-[14rem] text-sm text-neutral-700">{accessSummary(r)}</td>
                <td className="whitespace-nowrap text-sm text-neutral-600">{formatUpdatedAt(r.updatedAt)}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModalRoleId(r.id)}
                      className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
                    >
                      {r.is_full_access ? "View areas" : "Edit permissions"}
                    </button>
                    {canDelete(r) ? (
                      <form action={deleteAdminRole} className="inline">
                        <input type="hidden" name="role_id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-100"
                          onClick={(e) => {
                            if (!window.confirm(`Delete role “${r.label}” permanently?`)) e.preventDefault();
                          }}
                        >
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={resetAllRolePresetsToFullAccess}
        onSubmit={(e) => {
          if (!window.confirm("Set every role’s page list to all pages?")) e.preventDefault();
        }}
        className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4"
      >
        <div className="text-sm font-semibold text-amber-950">Reset all preset rows</div>
        <p className="mt-1 text-sm text-amber-950/80">
          Fills <span className="font-mono">role_pages</span> with the full page list for
          every role. Full-access behavior is unchanged in the app.
        </p>
        <button
          type="submit"
          className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-50"
        >
          Reset all to full access
        </button>
      </form>
    </div>
  );
}
