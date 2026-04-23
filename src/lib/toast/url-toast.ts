"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type ToastKind = "success" | "error" | "info";

function safeText(v: string | null) {
  const s = (v ?? "").trim();
  return s.length ? s.slice(0, 200) : null;
}

export function useUrlToast(options?: {
  keys?: { kind?: string; message?: string };
  defaultKind?: ToastKind;
  clearParams?: string[];
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const kindKey = options?.keys?.kind ?? "toast";
  const messageKey = options?.keys?.message ?? "message";
  const defaultKind = options?.defaultKind ?? "info";

  // Dedupe key to avoid double toasts in React Strict Mode remounts (dev).
  const dedupeKey = useMemo(() => `${pathname}?${sp.toString()}`, [pathname, sp]);

  useEffect(() => {
    const kindRaw = safeText(sp.get(kindKey));
    const errorParam = safeText(sp.get("error"));
    const msgParam = safeText(sp.get(messageKey));
    const msgRaw = msgParam ?? errorParam;

    if (!kindRaw && !msgRaw) return;

    // Prevent duplicate toasts for the exact same URL params.
    // In dev, React Strict Mode can mount/unmount/remount, which would otherwise fire twice.
    try {
      const now = Date.now();
      const raw = window.sessionStorage.getItem("__phalga_url_toast_last");
      const last = raw ? (JSON.parse(raw) as { k: string; t: number } | null) : null;
      if (last?.k === dedupeKey && now - last.t < 4000) return;
      window.sessionStorage.setItem("__phalga_url_toast_last", JSON.stringify({ k: dedupeKey, t: now }));
    } catch {
      // ignore
    }

    let kind: ToastKind = (kindRaw as ToastKind) || (msgRaw ? "error" : defaultKind);
    let msg = msgRaw ?? "Done.";

    // Special-case common patterns where `error` is a code and `msg` is the text.
    if (errorParam && errorParam.length <= 24 && msgParam) {
      kind = "error";
      msg = msgParam;
    }
    // Special-case success flags (e.g. ?unpaired=1)
    if (sp.get("unpaired") === "1") {
      kind = "success";
      msg = "Device unpaired.";
    }

    if (kind === "success") toast.success(msg);
    else if (kind === "error") toast.error(msg);
    else toast(msg);

    const next = new URLSearchParams(sp.toString());
    const toClear = new Set([kindKey, messageKey, "error", "msg", "unpaired", ...(options?.clearParams ?? [])]);
    for (const k of toClear) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedupeKey, sp, pathname, router, kindKey, messageKey, defaultKind, options?.clearParams]);
}

