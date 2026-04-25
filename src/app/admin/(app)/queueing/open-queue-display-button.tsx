"use client";

export function OpenQueueDisplayButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const url = `${window.location.origin}/queue-display`;
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm transition-colors hover:bg-indigo-100"
    >
      View queueing screen
    </button>
  );
}
