export default function AdminResultsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Results</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Live vote counts by geo group and candidate.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Live tallies</div>
        <p className="mt-2 text-xs text-neutral-500">
          Next: aggregate submitted ballots and subscribe via realtime for live updates.
        </p>
      </div>
    </div>
  );
}

