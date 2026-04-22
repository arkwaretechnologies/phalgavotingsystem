"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { setBoundTabletId } from "@/lib/tablet/device";

export default function TabletPairSuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const tabletRaw = sp.get("tablet");

  useEffect(() => {
    const n = tabletRaw ? Number(tabletRaw) : NaN;
    if (Number.isFinite(n) && n > 0) {
      setBoundTabletId(n);
      router.replace("/vote/login");
    }
  }, [tabletRaw, router]);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Paired</h1>
      <p className="mt-2 text-sm text-neutral-600">Redirecting to voter login…</p>
    </main>
  );
}

