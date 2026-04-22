import { adminLogin } from "./actions";

export default function AdminLoginPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Admin / Comelec Login</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Sign in to access the admin panel.
      </p>

      <form action={adminLogin} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Username</span>
          <input
            name="username"
            className="mt-1 w-full rounded-md border px-3 py-2"
            required
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            className="mt-1 w-full rounded-md border px-3 py-2"
            required
            autoComplete="current-password"
          />
        </label>

        <button type="submit" className="w-full rounded-md bg-black px-4 py-2 text-white">
          Sign in
        </button>
      </form>
    </div>
  );
}

