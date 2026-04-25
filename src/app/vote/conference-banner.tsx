import type { Conference } from "@/lib/db/types";

type Props = {
  conference: Conference | null;
  activeConfcode: string | null;
};

function formatDateRange(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  const f = from
    ? new Date(from + (from.length <= 10 ? "T12:00:00" : ""))
    : null;
  const t = to ? new Date(to + (to.length <= 10 ? "T12:00:00" : "")) : null;
  const short = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (f && t && !Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
    if (f.getTime() === t.getTime()) return short(f);
    return `${short(f)} – ${short(t)}`;
  }
  if (f && !Number.isNaN(f.getTime())) return short(f);
  if (t && !Number.isNaN(t.getTime())) return short(t);
  return null;
}

export function ConferenceBanner({ conference, activeConfcode }: Props) {
  if (!activeConfcode) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
        No conference is set in <span className="font-mono">app_settings</span>. Add
        <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/60">
          active_confcode
        </code>
        to show the correct candidates and title.
      </div>
    );
  }

  const title = conference?.name?.trim() || `Conference ${activeConfcode}`;
  const when = formatDateRange(conference?.date_from ?? null, conference?.date_to ?? null);
  const where = conference?.venue?.trim();

  return (
    <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-600 dark:text-slate-400">
        Conference
      </p>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl dark:text-white">
        {title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-slate-300">
        {when ? <span>{when}</span> : null}
        {where ? <span className="text-neutral-600 dark:text-slate-400">{where}</span> : null}
      </div>
    </div>
  );
}
