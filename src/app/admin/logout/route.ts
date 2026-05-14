import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin/session";

/** Build the public origin from forwarded headers so Railway/reverse-proxy redirects keep the user on the real host. */
function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost || req.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}

/**
 * 200 HTML "redirect" so the cookie-delete header isn't stripped by Railway's proxy
 * on 3xx responses (same reason as `/admin/login/submit`).
 */
function htmlRedirect(target: string) {
  const escaped = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${escaped}"><title>Redirecting…</title><script>window.location.replace(${JSON.stringify(target)});</script></head><body>Redirecting…</body></html>`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  await clearAdminSession();
  return htmlRedirect(`${getPublicOrigin(req)}/admin/login`);
}

