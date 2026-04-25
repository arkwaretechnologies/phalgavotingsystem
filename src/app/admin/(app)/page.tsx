import Link from "next/link";

function Card({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:bg-neutral-50"
    >
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm text-neutral-600">{description}</div>
    </Link>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Admin tools for voter verification, tablet management, and live results.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card
          title="Check-in"
          description="Search and verify voters; generate queue number and token"
          href="/admin/check-in"
        />
        <Card
          title="Queueing"
          description="View verified voters waiting with queued status"
          href="/admin/queueing"
        />
        <Card
          title="Voters"
          description="Import voter list via CSV"
          href="/admin/voters"
        />
        <Card
          title="Candidates"
          description="Add candidates and assign geo groups"
          href="/admin/candidates"
        />
        <Card
          title="Tablets"
          description="Pair devices and view tablet status board"
          href="/admin/tablets"
        />
        <Card
          title="Results"
          description="Live vote counts per geo group and candidate"
          href="/admin/results"
        />
        <Card
          title="Settings"
          description="Select the active conference (confcode)"
          href="/admin/settings"
        />
      </div>
    </div>
  );
}

