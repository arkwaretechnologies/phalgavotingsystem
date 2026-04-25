"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { claimPairCode } from "./actions";
import { getOrCreateDeviceId } from "@/lib/tablet/device";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useUrlToast } from "@/lib/toast/url-toast";

export default function TabletPairClient() {
  const sp = useSearchParams();
  const [deviceIdError, setDeviceIdError] = useState<string | null>(null);
  // Start with null so server + first client render match (avoid hydration mismatch).
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    // In some managed/kiosk setups, localStorage can be blocked. Show a clear message.
    try {
      setDeviceId(getOrCreateDeviceId());
      setDeviceIdError(null);
    } catch (e) {
      setDeviceIdError(
        e instanceof Error
          ? e.message
          : "Unable to access local storage to create a device id.",
      );
    }
  }, []);

  useUrlToast();

  const canSubmit = useMemo(() => Boolean(code.trim().length >= 4), [code]);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, []);

  function extractPairCode(text: string) {
    const raw = text.trim();
    // Expected payload from admin QR: {"pair_code":"XXXX...."}
    if (raw.startsWith("{")) {
      try {
        const obj = JSON.parse(raw) as { pair_code?: unknown };
        if (typeof obj.pair_code === "string" && obj.pair_code.trim()) return obj.pair_code.trim();
      } catch {
        // ignore
      }
    }
    // Fallback: treat as plain code.
    return raw;
  }

  async function startScan() {
    setScannerError(null);
    if (!videoRef.current) return;

    try {
      setIsScanning(true);
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;

      // Let the library choose a camera; on phones, it typically picks back camera.
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          const found = extractPairCode(result.getText()).toUpperCase();
          if (found) setCode(found);
          try {
            controlsRef.current?.stop();
          } catch {
            // ignore
          }
          controlsRef.current = null;
          readerRef.current = null;
          setIsScanning(false);
        } else if (err) {
          // ignore decode errors (no code in frame)
        }
      });
    } catch (e) {
      setScannerError(e instanceof Error ? e.message : "Unable to scan QR code");
    } finally {
      // Note: stopping is handled either by stop button or upon first successful scan.
    }
  }

  function stopScan() {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;
    readerRef.current = null;
    setIsScanning(false);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Pair this device</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Enter the pairing code from the admin tablets page, or scan the QR code.
      </p>

      {/* toast handles pairing errors */}

      <div className="mt-6 rounded-xl border border-neutral-200/80 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Scan QR</div>
          {isScanning ? (
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
              onClick={stopScan}
            >
              Stop
            </button>
          ) : (
            <button type="button" className="rounded-md bg-black px-3 py-2 text-sm text-white" onClick={startScan}>
              Start scan
            </button>
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-lg bg-neutral-100">
          <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
        </div>

        {scannerError ? (
          <p className="mt-2 text-xs text-red-600">{scannerError}</p>
        ) : (
          <p className="mt-2 text-xs text-neutral-600">
            Allow camera access when prompted. After scan, the code will auto-fill below.
          </p>
        )}
      </div>

      <form
        action={claimPairCode}
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          if (!canSubmit) e.preventDefault();
        }}
      >
        <input type="hidden" name="device_id" value={deviceId ?? ""} />

        <label className="block">
          <span className="text-sm font-medium">Pairing code</span>
          <input
            name="pair_code"
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-lg uppercase tracking-widest"
            placeholder="e.g. A1B2C3D4"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={!canSubmit}
        >
          Pair device
        </button>
      </form>

      <p className="mt-4 text-xs text-neutral-600">
        Device id:{" "}
        <span className="font-mono" suppressHydrationWarning>
          {deviceId ?? "…"}
        </span>
      </p>
      {deviceIdError ? (
        <p className="mt-2 text-xs text-rose-700">{deviceIdError}</p>
      ) : null}
    </main>
  );
}

