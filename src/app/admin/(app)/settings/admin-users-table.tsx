"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createAdminUser, deleteAdminUser, updateAdminUser } from "@/app/admin/settings/user-actions";

type AdminUserRow = {
  id: number;
  username: string | null;
  full_name: string | null;
  role_id: number | null;
  role_label: string;
  created_at: string | null;
};

type RoleOption = { id: number; label: string; slug: string };

export function AdminUsersTable({
  users,
  roleOptions,
  defaultAddRoleId,
  currentUserId,
}: {
  users: AdminUserRow[];
  roleOptions: RoleOption[];
  defaultAddRoleId: number;
  currentUserId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const deleteLabelRef = useRef("");

  const editing = editId != null ? users.find((u) => u.id === editId) : null;

  function runAction(fn: () => Promise<void>) {
    setFormError(null);
    startTransition(async () => {
      try {
        await fn();
        setAddOpen(false);
        setEditId(null);
        setConfirmOpen(false);
        setConfirmId(null);
        router.refresh();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div>
      {formError ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {formError}
        </div>
      ) : null}

      {addOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold">Add user</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                runAction(() => createAdminUser(fd));
              }}
            >
              <label className="block text-sm">
                <span className="font-medium">Username</span>
                <input
                  name="username"
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Full name</span>
                <input name="full_name" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Role</span>
                <select
                  name="role_id"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  defaultValue={String(defaultAddRoleId)}
                  required
                >
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                  onClick={() => setAddOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold">Edit user</div>
            <p className="mt-1 text-sm text-neutral-600">Leave password blank to keep the current one.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("id", String(editing.id));
                runAction(() => updateAdminUser(fd));
              }}
            >
              <input type="hidden" name="id" value={editing.id} />
              <label className="block text-sm">
                <span className="font-medium">Username</span>
                <input
                  name="username"
                  required
                  defaultValue={editing.username ?? ""}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Full name</span>
                <input
                  name="full_name"
                  defaultValue={editing.full_name ?? ""}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">New password (optional)</span>
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Role</span>
                <select
                  name="role_id"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  defaultValue={editing.role_id != null ? String(editing.role_id) : ""}
                  required
                >
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                  onClick={() => setEditId(null)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmOpen && confirmId != null ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold">Delete user</div>
            <div className="mt-2 text-sm text-neutral-600">Remove {deleteLabelRef.current} from admin users?</div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmId(null);
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                disabled={pending}
                onClick={() => {
                  const id = confirmId;
                  runAction(async () => {
                    if (id != null) await deleteAdminUser(id);
                  });
                }}
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setAddOpen(true);
          }}
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Add user
        </button>
      </div>

      <div className="admin-table-wrap overflow-x-auto">
        <table className="admin-table min-w-[32rem]">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full name</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-sm">{u.username}</td>
                <td>{u.full_name}</td>
                <td>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-800">
                    {u.role_label}
                  </span>
                </td>
                <td className="whitespace-nowrap text-sm text-neutral-600">
                  {u.created_at ? new Date(u.created_at).toLocaleString() : "—"}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-sm text-neutral-700 underline decoration-neutral-300 hover:text-black"
                      onClick={() => {
                        setFormError(null);
                        setEditId(u.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm text-rose-600 underline decoration-rose-200 hover:text-rose-800"
                      disabled={u.id === currentUserId}
                      onClick={() => {
                        setFormError(null);
                        deleteLabelRef.current = u.username ?? `#${u.id}`;
                        setConfirmId(u.id);
                        setConfirmOpen(true);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
