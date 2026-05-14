import { NextResponse } from "next/server";

/**
 * Railway/reverse-proxy aware redirect helpers.
 *
 * Two Railway-specific quirks are handled here:
 *
 *   1. `req.url` on a Railway upstream is the internal address
 *      (e.g. `http://localhost:8080`). To build correct absolute
 *      redirect targets we honor `x-forwarded-host` / `x-forwarded-proto`.
 *
 *   2. Railway's edge proxy drops `Set-Cookie` headers on non-GET 3xx
 *      responses. To keep cookies alive across a login/logout we return
 *      a 200 HTML page that performs a client-side redirect via
 *      `<meta http-equiv="refresh">` (and a `window.location.replace`
 *      fallback for older clients).
 *
 * Callers attach cookies via `response.cookies.set(...)` on the returned
 * `NextResponse` — that mutates the existing headers list rather than
 * overwriting it, so `Set-Cookie` survives.
 */

export function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost || req.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}

export function buildHtmlRedirect(target: string): NextResponse {
  const escaped = target
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${escaped}"><title>Redirecting…</title><script>window.location.replace(${JSON.stringify(target)});</script></head><body>Redirecting…</body></html>`;
  const response = new NextResponse(body, { status: 200 });
  response.headers.set("content-type", "text/html; charset=utf-8");
  response.headers.set("cache-control", "no-store");
  return response;
}
