export default function AdminLoginPage() {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Admin / Comelec Login</h1>
      <p className="mt-2 text-sm text-neutral-600">
        This will be wired to your <span className="font-mono">admin_users</span> table next.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Username</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input type="password" className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
      </div>

      <button
        type="button"
        className="mt-4 rounded-md bg-black px-4 py-2 text-white"
        disabled
      >
        Sign in (next)
      </button>
    </div>
  );
}

