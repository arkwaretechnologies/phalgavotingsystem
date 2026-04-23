import { Suspense } from "react";
import TabletPairClient from "./pair-client";

export default function TabletPairPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <h1 className="text-2xl font-semibold">Pair this device</h1>
          <p className="mt-2 text-sm text-neutral-600">Loading…</p>
        </main>
      }
    >
      <TabletPairClient />
    </Suspense>
  );
}

