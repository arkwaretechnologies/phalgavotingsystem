import { Suspense } from "react";
import { adminLogin } from "./actions";
import { UrlToasts } from "@/app/_components/UrlToasts";

export default function AdminLoginPage() {
  return (
    <div>
      <Suspense fallback={null}>
        <UrlToasts />
      </Suspense>
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Admin / Comelec</h1>
        <p className="mt-2 text-sm text-neutral-600">Sign in to open the dashboard and run election tools.</p>
      </div>

      <form action={adminLogin} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-neutral-800">Username</span>
          <input
            name="username"
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-neutral-900 shadow-sm outline-none transition focus:border-[#050203] focus:ring-2 focus:ring-[#050203]/15"
            required
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-800">Password</span>
          <input
            name="password"
            type="password"
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-neutral-900 shadow-sm outline-none transition focus:border-[#050203] focus:ring-2 focus:ring-[#050203]/15"
            required
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          className="ph-glossy-black w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98]"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
