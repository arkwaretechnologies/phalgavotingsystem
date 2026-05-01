import Link from "next/link";

const cardClass =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-md active:scale-[0.99]";

export default function Home() {
  return (
    <div className="ph-flag-hero-wash relative flex min-h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-white text-neutral-900">
      <div aria-hidden className="ph-flag-strip-top" />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="admin-hero-fade text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ph-flag-blue)]">PhALGA</p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">Phalga Electronic Voting System</h1>
          <p className="mt-3 max-w-2xl text-pretty text-base text-neutral-600 sm:text-lg">
            Choose your role to continue. Staff sign in to open the control panel, then use the
            dashboard to run check-in, queueing, and results.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="admin-hero-fade admin-hero-fade-delay-1 sm:col-span-2">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Election staff</h2>
            <Link
              href="/admin/login"
              className="ph-glossy-black group relative flex flex-col overflow-hidden rounded-2xl p-5 transition duration-300 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="text-lg font-semibold text-white">Admin / Comelec</div>
              <div className="mt-1.5 text-sm text-white/85">
                Sign in first, then use the full dashboard: check-in, candidates, results, and more.
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white/95">
                Go to sign in
                <span className="inline-block transition group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </div>
            </Link>
          </div>

          <div className="admin-hero-fade admin-hero-fade-delay-2">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Voters</h2>
            <Link href="/vote" className={cardClass}>
              <div className="text-lg font-semibold">Voter</div>
              <div className="mt-1.5 text-sm text-neutral-600">Log in with queue number and 6-digit token</div>
              <div className="mt-4 text-sm font-medium text-[var(--ph-flag-blue)] transition group-hover:underline">Enter voting flow →</div>
            </Link>
          </div>

          <div className="admin-hero-fade admin-hero-fade-delay-3 sm:col-span-2">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Devices</h2>
            <Link href="/tablet" className={cardClass}>
              <div className="text-lg font-semibold">Tablet / device</div>
              <div className="mt-1.5 text-sm text-neutral-600">
                Pair this device, then run the queue display on the tablet
              </div>
              <div className="mt-4 text-sm font-medium text-[var(--ph-flag-blue)] transition group-hover:underline">Open device setup →</div>
            </Link>
          </div>
        </div>

        <p className="admin-hero-fade admin-hero-fade-delay-3 mt-8 text-center text-xs text-neutral-500 sm:text-left">
          Staff can bookmark{" "}
          <span className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-neutral-800">
            /admin/login
          </span>{" "}
          for quick access.
        </p>
      </main>

      <div aria-hidden className="ph-flag-strip-bottom" />
    </div>
  );
}
