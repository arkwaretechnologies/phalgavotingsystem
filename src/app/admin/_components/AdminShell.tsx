"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/check-in", label: "Check-in" },
  { href: "/admin/queueing", label: "Queueing" },
  { href: "/admin/voters", label: "Voters" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/ballots", label: "Ballots" },
  { href: "/admin/tablets", label: "Tablets" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/canvass", label: "Canvass" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-full bg-neutral-50">
      <div className="mx-auto grid max-w-6xl gap-6 p-6 sm:grid-cols-[240px_1fr]">
        <aside>
          <div className="rounded-2xl border bg-white p-3 shadow-sm">
            <Link href="/admin" className="block rounded-xl px-3 py-2">
              <div className="text-sm font-semibold">PhALGA Admin</div>
              <div className="mt-0.5 text-xs text-neutral-500">Election control panel</div>
            </Link>

            <div className="mt-2 grid gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-xl px-3 py-2 text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-3 border-t pt-3">
              <Link
                href="/admin/logout"
                className="block rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Logout
              </Link>
              <Link
                href="/"
                className="mt-1 block rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Back to home
              </Link>
            </div>
          </div>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}

