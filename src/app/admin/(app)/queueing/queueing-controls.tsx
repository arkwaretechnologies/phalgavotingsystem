"use client";

import { useEffect, useId, useState, useTransition } from "react";

type Tone = "amber" | "emerald";

const TONE_CLASSES: Record<Tone, { confirm: string; iconBg: string; iconText: string }> = {
  amber: {
    confirm:
      "bg-amber-600 text-white hover:bg-amber-700 focus-visible:outline-amber-700",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
  },
  emerald: {
    confirm:
      "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-700",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
  },
};

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  tone,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  tone: Tone;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const t = TONE_CLASSES[tone];

  return (
    <div
      className="ph-brand-scrim fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 sm:p-6">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.iconBg} ${t.iconText}`}
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0 3.75h.007M21.75 12a9.75 9.75 0 11-19.5 0 9.75 9.75 0 0119.5 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            <div id={descId} className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              {description}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${t.confirm}`}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkipCurrentForm({
  action,
  queueNumber,
}: {
  action: (formData: FormData) => Promise<void>;
  queueNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await action(new FormData());
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-100"
      >
        Skip #{queueNumber} & call next
      </button>
      <ConfirmModal
        open={open}
        title={`Skip queue #${queueNumber}?`}
        description={
          <>
            <p>The next number will be called and shown as “Now serving”.</p>
            <p className="mt-2">
              The voter keeps their queue # and token — re-call them from the{" "}
              <span className="font-semibold">Skipped</span> list when they return.
            </p>
          </>
        }
        confirmLabel={`Skip & call next`}
        pendingLabel="Skipping…"
        tone="amber"
        isPending={isPending}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export function RecallSkippedForm({
  action,
  sessionId,
  queueNumber,
}: {
  action: (formData: FormData) => Promise<void>;
  sessionId: string;
  queueNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("session_id", sessionId);
      await action(fd);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100"
      >
        Re-call
      </button>
      <ConfirmModal
        open={open}
        title={`Re-call queue #${queueNumber}?`}
        description={
          <p>
            This brings #{queueNumber} back onto the queue display. Since it’s the lowest active
            number, it will appear as “Now serving” right away.
          </p>
        }
        confirmLabel="Re-call"
        pendingLabel="Re-calling…"
        tone="emerald"
        isPending={isPending}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
