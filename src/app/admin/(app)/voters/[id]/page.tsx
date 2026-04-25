import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { UrlToasts } from "@/app/_components/UrlToasts";
import { deleteVoter, updateVoter } from "@/app/admin/voters/crud-actions";

export default async function AdminEditVoterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const sp = (await searchParams) ?? {};
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const supabase = createSupabaseServiceRoleClient();
  const { data: voter, error } = await supabase
    .from("voters")
    .select("id, full_name, position, lgu, province, province_league, psgc_code, email, phone")
    .eq("id", id)
    .maybeSingle();

  if (error || !voter) notFound();

  const draft = {
    full_name: String(get("full_name") ?? voter.full_name ?? ""),
    position: String(get("position") ?? voter.position ?? ""),
    lgu: String(get("lgu") ?? voter.lgu ?? ""),
    province: String(get("province") ?? voter.province ?? ""),
    province_league: String(get("province_league") ?? voter.province_league ?? ""),
    psgc_code: String(get("psgc_code") ?? voter.psgc_code ?? ""),
    email: String(get("email") ?? voter.email ?? ""),
    phone: String(get("phone") ?? voter.phone ?? ""),
  };

  return (
    <div className="space-y-6">
      <UrlToasts />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Edit voter</h1>
            <p className="mt-2 text-sm text-neutral-600">Update or delete this voter. Requires your password.</p>
            <div className="mt-2 text-xs text-neutral-500">
              ID <span className="font-mono">{String(voter.id)}</span>
            </div>
          </div>
          <a href="/admin/voters" className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50">
            Back
          </a>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <form action={updateVoter} className="grid gap-4">
          <input type="hidden" name="id" value={String(voter.id)} />
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
            <div className="text-sm font-semibold">Confirm update</div>
            <p className="mt-1 text-xs text-neutral-600">Enter your admin password to save changes.</p>
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
              Save changes
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="text-sm font-semibold text-rose-900">Delete voter</div>
        <p className="mt-1 text-xs text-rose-800">
          This cannot be undone. If the voter has related sessions/ballots, delete may fail due to database constraints.
        </p>
        <form action={deleteVoter} className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <input type="hidden" name="id" value={String(voter.id)} />
          <input
            name="password"
            type="password"
            className="rounded-md border border-rose-200 px-3 py-2"
            placeholder="Confirm password"
            required
          />
          <div className="flex justify-end">
            <button type="submit" className="rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700">
              Delete voter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

