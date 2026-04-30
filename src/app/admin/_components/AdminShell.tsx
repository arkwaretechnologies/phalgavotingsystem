"use client";

import type { AdminPageKey } from "@/lib/admin/admin-page-keys";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name:
    | "dashboard"
    | "check"
    | "queue"
    | "users"
    | "candidate"
    | "ballot"
    | "tablet"
    | "chart"
    | "doc"
    | "settings"
    | "logout"
    | "home";
  className?: string;
}) {
  const common = { className: `${className} shrink-0`, fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.75, stroke: "currentColor" as const };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
    case "queue":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      );
    case "candidate":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.384a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      );
    case "ballot":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V12M10.5 2.25h5.25m-7.5 6h3m-3 3h3m-3 3h3" />
        </svg>
      );
    case "tablet":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 19.19 5.19 22 11.25 22c6.06 0 8.25-2.81 8.25-8.875V4.125C19.5 2.19 17.31 0 11.25 0 5.19 0 3 2.19 3 4.125v8.25ZM3 13.125v6.75c0 1.19.19 2.19.56 3M9.75 3v11.25m5.25-4.5v7.5" />
        </svg>
      );
    case "doc":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375H16.5a5.23 5.23 0 0 0-1.279-2.184m0 0A5.23 5.23 0 0 0 12 7.5h-.75M4.5 18.75h6m-1.5-2.25h-3.75m.75-2.25H9m-1.5-2.25H4.5m0-3.75H9m-1.5-2.25H4.5M12 2.25h3.75a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 1-1.5-1.5V3.75a1.5 1.5 0 0 0-1.5-1.5H4.5M12 2.25H9" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.37.49l-1.217-.456c-.355-.132-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.645.87l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.49l1.216.456c.356.132.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.87l.213-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
      );
    default:
      return null;
  }
}

const NAV_ITEMS = [
  { pageKey: "dashboard" as const, href: "/admin", label: "Dashboard", icon: "dashboard" as const },
  { pageKey: "check_in" as const, href: "/admin/check-in", label: "Check-in", icon: "check" as const },
  { pageKey: "queueing" as const, href: "/admin/queueing", label: "Queueing", icon: "queue" as const },
  { pageKey: "voters" as const, href: "/admin/voters", label: "Voters", icon: "users" as const },
  { pageKey: "candidates" as const, href: "/admin/candidates", label: "Candidates", icon: "candidate" as const },
  { pageKey: "tablets" as const, href: "/admin/tablets", label: "Tablets", icon: "tablet" as const },
  { pageKey: "canvass" as const, href: "/admin/canvass", label: "Canvass", icon: "doc" as const },
  { pageKey: "settings" as const, href: "/admin/settings/conference", label: "Settings", icon: "settings" as const },
] as const;

function settingsSubClass(active: boolean) {
  return [
    "block rounded-lg border-l-2 py-1.5 pl-2.5 pr-2 text-sm leading-snug",
    active
      ? "border-black bg-white/90 font-medium text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
      : "border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100/80 hover:text-neutral-900",
  ].join(" ");
}

export default function AdminShell({
  children,
  allowedPageKeys,
  isSystemSuper,
}: {
  children: React.ReactNode;
  allowedPageKeys: AdminPageKey[];
  /** `super_admin` system role: user + role management submenu */
  isSystemSuper: boolean;
}) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const settingsInPath = pathname.startsWith("/admin/settings");
  const [settingsExpanded, setSettingsExpanded] = useState(settingsInPath);

  useEffect(() => {
    if (settingsInPath) setSettingsExpanded(true);
  }, [settingsInPath]);

  const allow = new Set(allowedPageKeys);
  const visibleNav = NAV_ITEMS.filter((item) => allow.has(item.pageKey));
  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.pageKey === "settings") {
      return pathname.startsWith("/admin/settings");
    }
    if (item.href === "/admin") return pathname === "/admin" || pathname === "/admin/";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const confPath = "/admin/settings/conference";
  const votingSchedulePath = "/admin/settings/voting-schedule";
  const settingsRootActive =
    pathname === confPath || pathname === "/admin/settings" || pathname === "/admin/settings/";
  const usersPathActive = pathname.startsWith("/admin/settings/users");
  const rolesPathActive = pathname.startsWith("/admin/settings/roles");
  const votingSchedulePathActive = pathname.startsWith(votingSchedulePath);
  const confSubActive =
    settingsRootActive && !usersPathActive && !rolesPathActive && !votingSchedulePathActive;

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-neutral-100 text-neutral-900">
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-bold text-white">
              P
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">PhALGA Admin</span>
              <span className="block truncate text-xs text-neutral-500">Election control</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Open admin navigation"
            aria-expanded={isMobileNavOpen}
            aria-controls="admin-sidebar"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-sm transition active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </header>

        <button
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setIsMobileNavOpen(false)}
          className={[
            "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ease-out lg:hidden motion-reduce:transition-none",
            isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        />

        <aside
          id="admin-sidebar"
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] transform-gpu flex-col border-r border-neutral-200/80 bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
            isMobileNavOpen
              ? "translate-x-0"
              : "pointer-events-none -translate-x-[105%]",
            "lg:pointer-events-auto lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:max-h-dvh lg:w-72 lg:shrink-0 lg:translate-x-0 lg:shadow-sm",
          ].join(" ")}
        >
          <div className="flex max-h-full min-h-0 flex-col p-4 lg:overflow-hidden">
            <div className="flex shrink-0 items-start gap-2">
              <Link
                href="/admin"
                onClick={() => setIsMobileNavOpen(false)}
                className="ph-glossy-black group flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-3.5 transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <span className="text-lg font-bold tracking-tight">P</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">PhALGA Admin</div>
                  <div className="mt-0.5 text-xs text-white/75">Election control</div>
                </div>
              </Link>
              <button
                type="button"
                aria-label="Close admin navigation"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition active:scale-95 lg:hidden"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300/90">
              {visibleNav.map((item) => {
                if (item.pageKey === "settings") {
                  const parentActive = pathname.startsWith("/admin/settings");
                  return (
                    <div key="settings" className="space-y-1">
                      <button
                        type="button"
                        aria-expanded={settingsExpanded}
                        aria-controls="admin-settings-submenu"
                        onClick={() => setSettingsExpanded((open) => !open)}
                        className={[
                          "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium",
                          parentActive ? "nav-sidebar-active" : "nav-sidebar-inactive hover:translate-x-0.5",
                        ].join(" ")}
                      >
                        <span
                          className={
                            parentActive
                              ? "text-white"
                              : "text-neutral-500 transition group-hover:text-white"
                          }
                        >
                          <Icon name="settings" />
                        </span>
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {parentActive ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-white/90 ring-1 ring-white/30" />
                          ) : null}
                          <svg
                            className={[
                              "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                              parentActive ? "text-white/90" : "text-neutral-400 group-hover:text-white",
                              settingsExpanded ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </span>
                      </button>
                      {settingsExpanded ? (
                        <div
                          id="admin-settings-submenu"
                          className="space-y-0.5 border-l border-neutral-200/90 pb-0.5 pl-3 ml-3"
                          role="group"
                          aria-label="Settings submenu"
                        >
                          <Link
                            href={confPath}
                            onClick={() => setIsMobileNavOpen(false)}
                            className={settingsSubClass(confSubActive)}
                          >
                            Conference
                          </Link>
                          <Link
                            href={votingSchedulePath}
                            onClick={() => setIsMobileNavOpen(false)}
                            className={settingsSubClass(votingSchedulePathActive)}
                          >
                            Voting schedule
                          </Link>
                          {isSystemSuper ? (
                            <>
                              <Link
                                href="/admin/settings/users"
                                onClick={() => setIsMobileNavOpen(false)}
                                className={settingsSubClass(usersPathActive)}
                              >
                                Users
                              </Link>
                              <Link
                                href="/admin/settings/roles"
                                onClick={() => setIsMobileNavOpen(false)}
                                className={settingsSubClass(rolesPathActive)}
                              >
                                Role management
                              </Link>
                            </>
                          ) : (
                            <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
                              <span className="font-medium text-neutral-600">Users</span> and{" "}
                              <span className="font-medium text-neutral-600">Role management</span> are
                              only shown when you sign in with the{" "}
                              <span className="font-medium">Super admin</span> role (
                              <span className="font-mono">super_admin</span> in the database). If your
                              account was set to another role, ask an admin to set your{" "}
                              <span className="font-mono">admin_users.role_id</span> to that role, then
                              log out and sign in again.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileNavOpen(false)}
                    className={[
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",
                      active ? "nav-sidebar-active" : "nav-sidebar-inactive hover:translate-x-0.5",
                    ].join(" ")}
                  >
                    <span
                      className={
                        active ? "text-white" : "text-neutral-500 transition group-hover:text-white"
                      }
                    >
                      <Icon name={item.icon} />
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
                    {active ? (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90 ring-1 ring-white/30" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 shrink-0 space-y-1.5 border-t border-neutral-200/80 pt-4">
              <Link
                href="/admin/logout"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition duration-200 hover:translate-x-0.5 hover:text-rose-600"
              >
                <Icon name="logout" className="h-4 w-4 text-rose-500/80" />
                Logout
              </Link>
              <Link
                href="/"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition duration-200 hover:translate-x-0.5 hover:text-neutral-800"
              >
                <Icon name="home" className="h-4 w-4 text-neutral-400" />
                Back to home
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-white p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
