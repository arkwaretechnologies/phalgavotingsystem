import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">PhALGA Voting System</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Choose how you want to proceed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/vote/login"
            className="rounded-xl border bg-black px-4 py-4 text-white transition-colors hover:bg-neutral-800"
          >
            <div className="text-base font-semibold">Voter</div>
            <div className="mt-1 text-sm text-neutral-200">
              Login with queue number + 6-digit token
            </div>
          </Link>

          <Link
            href="/admin/login"
            className="rounded-xl border bg-white px-4 py-4 text-black transition-colors hover:bg-neutral-50"
          >
            <div className="text-base font-semibold">Admin / Comelec</div>
            <div className="mt-1 text-sm text-neutral-600">
              Check-in voters, manage candidates, view results
            </div>
          </Link>
        </div>

        <p className="mt-6 text-xs text-neutral-500">
          Tip: Staff can bookmark <span className="font-mono">/admin/login</span>.
        </p>
      </div>
    </main>
  );
}
