"use client";

import QRCode from "qrcode";
import { useRef, useState } from "react";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const RECEIPT_WIDTH_MM = 80;

function buildReceiptHtml(opts: {
  queue: string;
  token: string;
  voterId: string;
  qrDataUrl: string;
  qrCaption: string;
}) {
  const w = RECEIPT_WIDTH_MM;

  // Thermal-friendly: keep it simple, high contrast, monospace-ish.
  const pageRule = `@page { size: ${w}mm auto; margin: 0; }`;
  const bodyRule = `width: ${w}mm;`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Print</title>
    <style>
      :root { color-scheme: light; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body {
        ${bodyRule}
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        line-height: 1.2;
      }
      .pad { padding: 2mm 2mm 3mm; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .muted { color: #333; }
      .hr { border-top: 1px dashed #000; margin: 6px 0; flex-shrink: 0; }
      .kv { text-align: center; flex-shrink: 0; }
      .kv + .kv { margin-top: 6px; }
      .kv-label { display: block; }
      .kv-value { display: block; margin-top: 2px; word-break: break-all; }
      .big { font-size: 18px; letter-spacing: 0.08em; }
      .qr { margin-top: 12px; text-align: center; }
      .qr img { width: 46mm; height: auto; image-rendering: pixelated; }
      .qr-cap { margin-top: 6px; font-size: 10px; color: #222; text-align: center; }
      ${pageRule}
      @media print {
        body { ${bodyRule} }
      }
    </style>
  </head>
  <body>
    <div class="pad">
      <div class="center bold">CHECK-IN RECEIPT</div>
      <div class="hr"></div>

      <div class="kv">
        <div class="muted kv-label">Queue</div>
        <div class="bold big kv-value">${escapeHtml(opts.queue)}</div>
      </div>
      <div class="kv">
        <div class="muted kv-label">Ballot Code</div>
        <div class="bold big kv-value">${escapeHtml(opts.token)}</div>
      </div>

      <div class="hr"></div>
      <div class="kv">
        <div class="muted kv-label">Voter</div>
        <div class="kv-value">${escapeHtml(opts.voterId)}</div>
      </div>

      <div class="qr">
        <img alt="QR" src="${opts.qrDataUrl}" />
        <div class="qr-cap">${escapeHtml(opts.qrCaption)}</div>
      </div>
    </div>
  </body>
</html>`;
}

function printHtmlInHiddenIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  };

  // Wait for layout + image decode where supported.
  const win = iframe.contentWindow;
  const maybePrint = () => {
    try {
      win?.focus();
      win?.print();
    } finally {
      // Some browsers finish print async; delay cleanup slightly.
      window.setTimeout(cleanup, 500);
    }
  };

  const imgs = Array.from(doc.images ?? []);
  if (imgs.length === 0) {
    window.requestAnimationFrame(maybePrint);
    return;
  }

  void Promise.all(
    imgs.map((img) => {
      const d = img.decode?.();
      return d ? d.catch(() => undefined) : Promise.resolve();
    }),
  ).finally(() => window.requestAnimationFrame(maybePrint));
}

export function ThermalReceiptPrintActions({
  queue,
  token,
  voterId,
}: {
  queue: string;
  token: string;
  voterId: string;
}) {
  const printingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {error ? <div className="w-full text-xs text-rose-700">{error}</div> : null}
      <button
        type="button"
        className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
        onClick={async () => {
          if (printingRef.current) return;
          printingRef.current = true;
          setError(null);
          try {
            const voteLoginUrl = `${window.location.origin}/vote/login`;
            const qr = await QRCode.toDataURL(voteLoginUrl, {
              errorCorrectionLevel: "M",
              margin: 1,
              width: 320,
            });
            const html = buildReceiptHtml({
              queue,
              token,
              voterId,
              qrDataUrl: qr,
              qrCaption: "/vote/login",
            });
            printHtmlInHiddenIframe(html);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to generate QR for printing.");
          } finally {
            printingRef.current = false;
          }
        }}
      >
        Print Queue No
      </button>
    </div>
  );
}
