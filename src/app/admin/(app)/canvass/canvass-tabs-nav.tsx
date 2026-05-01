"use client";

import Link from "next/link";

const TABS = [
  { key: "canvass", label: "Canvass" },
  { key: "results", label: "Results" },
  { key: "ballots", label: "Ballots" },
] as const;

export type CanvassTabKey = (typeof TABS)[number]["key"];

export function CanvassTabsNav({ activeTab }: { activeTab: CanvassTabKey }) {
  return (
    <div
      className="rounded-2xl border border-neutral-200/80 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Canvass sections"
    >
      <div className="flex gap-1">
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <Link
              key={t.key}
              href={`/admin/canvass?tab=${t.key}`}
              role="tab"
              aria-selected={active}
              className={[
                "relative inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
                active
                  ? "ph-brand-pill-active"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
