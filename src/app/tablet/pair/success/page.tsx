import { Suspense } from "react";
import TabletPairSuccessClient from "./success-client";

export default function TabletPairSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <h1 className="text-2xl font-semibold">Paired</h1>
          <p className="mt-2 text-sm text-neutral-600">Redirecting to tablet view…</p>
        </main>
      }
    >
      <TabletPairSuccessClient />
    </Suspense>
  );
}

