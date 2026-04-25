import { UrlToasts } from "@/app/_components/UrlToasts";
import { createVoter } from "@/app/admin/voters/crud-actions";

export default async function AdminNewVoterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Preserve draft values on invalid password by reading them from the URL.
  // Password is never preserved.
  const sp = (await searchParams) ?? {};
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const draft = {
    full_name: String(get("full_name") ?? ""),
    position: String(get("position") ?? ""),
    lgu: String(get("lgu") ?? ""),
    province: String(get("province") ?? ""),
    province_league: String(get("province_league") ?? ""),
    psgc_code: String(get("psgc_code") ?? ""),
    email: String(get("email") ?? ""),
    phone: String(get("phone") ?? ""),
  };
  return (
    <div className="space-y-6">
      <UrlToasts />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">New voter</h1>
            <p className="mt-2 text-sm text-neutral-600">Create a voter record. Requires your password.</p>
          </div>
          <a href="/admin/voters" className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50">
            Back
          </a>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <form action={createVoter} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Full name *</span>
            <input
              name="full_name"
              defaultValue={draft.full_name}
              className="rounded-md border px-3 py-2"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Position</span>
              <input name="position" defaultValue={draft.position} className="rounded-md border px-3 py-2" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">LGU</span>
              <input name="lgu" defaultValue={draft.lgu} className="rounded-md border px-3 py-2" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Province</span>
              <input name="province" defaultValue={draft.province} className="rounded-md border px-3 py-2" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Province league</span>
              <input
                name="province_league"
                defaultValue={draft.province_league}
                className="rounded-md border px-3 py-2"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">PSGC code</span>
              <input name="psgc_code" defaultValue={draft.psgc_code} className="rounded-md border px-3 py-2" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Email</span>
              <input name="email" type="email" defaultValue={draft.email} className="rounded-md border px-3 py-2" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Phone</span>
              <input name="phone" defaultValue={draft.phone} className="rounded-md border px-3 py-2" />
            </label>
          </div>

          <div className="rounded-xl border bg-neutral-50 p-4">
            <div className="text-sm font-semibold">Confirm</div>
            <p className="mt-1 text-xs text-neutral-600">Enter your admin password to submit.</p>
            <label className="mt-3 grid gap-1">
              <span className="text-sm font-medium">Password *</span>
              <input name="password" type="password" className="rounded-md border px-3 py-2" required />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <a href="/admin/voters" className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50">
              Cancel
            </a>
            <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">
              Create voter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

