"use client";

import { useRef, useState } from "react";
import { adminUnpairTablet } from "./unpair-actions";

export function UnpairCard({
  tabletId,
  pairedDeviceId,
}: {
  tabletId: number;
  pairedDeviceId: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<null | (() => void)>(null);

  function openConfirm(onConfirm: () => void) {
    confirmActionRef.current = onConfirm;
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    confirmActionRef.current = null;
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
            <div className="text-base font-semibold">Unpair tablet</div>
            <div className="mt-2 text-sm text-neutral-600">
              Unpair this tablet from device{" "}
              <span className="font-mono text-xs">{pairedDeviceId}</span>?
            </div>
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

      <div className="text-sm font-semibold">Pairing lock</div>
      <p className="mt-2 text-sm text-neutral-600">
        This tablet is currently paired to a device:
      </p>
      <div className="mt-2 rounded-lg border bg-neutral-50 px-3 py-2 font-mono text-xs">
        {pairedDeviceId}
      </div>

      <form action={adminUnpairTablet} className="mt-4">
        <input type="hidden" name="tablet_id" value={String(tabletId)} />
        <button
          type="button"
          className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          onClick={(e) => {
            const form = (e.currentTarget as HTMLButtonElement).form;
            if (!form) return;
            openConfirm(() => form.requestSubmit());
          }}
        >
          Unpair
        </button>
      </form>
    </div>
  );
}

