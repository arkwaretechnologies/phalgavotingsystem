"use client";

import { useRef, useState } from "react";
import { deleteTablet, updateTablet } from "@/app/admin/tablets/tablet-actions";

export function TabletEditor({
  id,
  label,
  status,
}: {
  id: number;
  label: string;
  status: string | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState<string>("Confirm");
  const [confirmMessage, setConfirmMessage] = useState<string>("");
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
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
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

      <div className="text-sm font-semibold">Edit tablet</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <form action={updateTablet} className="grid gap-3">
          <input type="hidden" name="id" value={String(id)} />
          <label className="block">
            <span className="text-sm font-medium">Label</span>
            <input
              name="label"
              defaultValue={label}
              className="mt-1 w-full rounded-md border px-3 py-2"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Status</span>
            <select
              name="status"
              defaultValue={status ?? "offline"}
              className="mt-1 w-full rounded-md border px-3 py-2"
            >
              <option value="vacant">vacant</option>
              <option value="in_use">in_use</option>
              <option value="offline">offline</option>
            </select>
          </label>

          <button
            type="button"
            className="ph-brand-button mt-1 rounded-md px-4 py-2"
            onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).form;
              if (!form) return;
              openConfirm({
                title: "Save changes",
                message: `Save changes to tablet "${label}" (ID ${id})?`,
                onConfirm: () => form.requestSubmit(),
              });
            }}
          >
            Save
          </button>
        </form>

        <form action={deleteTablet} className="grid gap-3">
          <input type="hidden" name="id" value={String(id)} />
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-800">Delete tablet</div>
            <p className="mt-1 text-sm text-red-700">
              This will remove the tablet record. Only do this if you are sure.
            </p>
            <button
              type="button"
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              onClick={(e) => {
                const form = (e.currentTarget as HTMLButtonElement).form;
                if (!form) return;
                openConfirm({
                  title: "Delete tablet",
                  message: `Delete tablet "${label}" (ID ${id})? This cannot be undone.`,
                  onConfirm: () => form.requestSubmit(),
                });
              }}
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

