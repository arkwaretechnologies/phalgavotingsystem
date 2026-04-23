"use client";

import { useEffect, useState } from "react";
import { clearBoundTabletId, getBoundTabletId, getDeviceId } from "@/lib/tablet/device";
import { assignNextSession, markTabletVacant, unpairTabletFromDevice } from "./actions";

type TabletRow = {
  id: number;
  label: string;
  status: string | null;
  current_session: string | null;
  last_active_at: string | null;
};

type VotingSessionRow = {
  id: string;
  queue_number: number;
  status: string | null;
  tablet_id: number | null;
};

export default function TabletClient() {
  const [tabletId, setTabletId] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [tablet, setTablet] = useState<TabletRow | null>(null);
  const [queue, setQueue] = useState<VotingSessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTabletId(getBoundTabletId());
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!tabletId) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/tablet/state?tablet_id=${encodeURIComponent(String(tabletId))}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as
          | { tablet: TabletRow | null; queue: VotingSessionRow[] }
          | { error: string };
        if (!cancelled) {
          if (!res.ok || "error" in json) {
            setError("error" in json ? json.error : "Unable to load tablet state");
            return;
          }
          setError(null);
          setTablet(json.tablet ?? null);
          setQueue(json.queue ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load tablet state");
      }
    }

    void load();
    const interval = window.setInterval(load, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tabletId]);

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Tablet</div>
        <p className="mt-2 text-sm text-neutral-600">{error}</p>
        <p className="mt-2 text-xs text-neutral-500">If this persists, check your database policies.</p>
      </div>
    );
  }

  if (!tabletId) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Not paired</div>
        <p className="mt-2 text-sm text-neutral-600">
          This device is not paired to a tablet yet.
        </p>
        <a className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-white" href="/tablet/pair">
          Pair device
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Tablet</h1>
            <p className="mt-1 text-sm text-neutral-600">
              ID {tabletId} {tablet?.label ? `• ${tablet.label}` : ""}
            </p>
          </div>
          <form
            action={unpairTabletFromDevice}
            onSubmit={() => {
              // Clear local storage right before navigation.
              clearBoundTabletId();
              setTabletId(null);
            }}
          >
            <input type="hidden" name="tablet_id" value={String(tabletId)} />
            <input type="hidden" name="device_id" value={deviceId ?? ""} />
            <button
              type="submit"
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
              disabled={!deviceId}
              title={!deviceId ? "Device id not available" : undefined}
            >
              Unpair
            </button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-500">Status</div>
            <div className="mt-1 text-sm font-semibold">{tablet?.status ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-500">Current session</div>
            <div className="mt-1 font-mono text-xs">{tablet?.current_session ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-neutral-500">Last active</div>
            <div className="mt-1 text-sm">
              {tablet?.last_active_at ? new Date(tablet.last_active_at).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={assignNextSession}>
            <input type="hidden" name="tablet_id" value={String(tabletId)} />
            <button className="rounded-md bg-black px-4 py-2 text-sm text-white" type="submit">
              Assign next voter
            </button>
          </form>
          <form action={markTabletVacant}>
            <input type="hidden" name="tablet_id" value={String(tabletId)} />
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50" type="submit">
              Mark vacant
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Queue (top 20)</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="border-b px-2 py-2 font-medium">Queue #</th>
                <th className="border-b px-2 py-2 font-medium">Status</th>
                <th className="border-b px-2 py-2 font-medium">Tablet</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {queue.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50">
                  <td className="border-b px-2 py-2">{s.queue_number}</td>
                  <td className="border-b px-2 py-2">{s.status ?? "—"}</td>
                  <td className="border-b px-2 py-2">{s.tablet_id ?? "—"}</td>
                </tr>
              ))}
              {queue.length === 0 ? (
                <tr>
                  <td className="px-2 py-6 text-sm text-neutral-500" colSpan={3}>
                    No active queue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

