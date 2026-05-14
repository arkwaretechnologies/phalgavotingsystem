import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin/session";
import { buildHtmlRedirect, getPublicOrigin } from "@/lib/http/railway-redirect";

/**
 * Return true when the incoming request is a speculative prefetch (Next.js
 * `<Link>` viewport prefetch, browser speculation rules, search-engine bots,
 * link-preview scrapers, etc.) rather than a real user-initiated logout.
 *
 * Why we care: this endpoint has the side effect of clearing the admin
 * session cookie. If Next.js / the browser prefetches it, we'd wipe the
 * session of a user who never clicked logout. We discovered this in
 * production: the logout `<Link>` in the sidebar was prefetched on page
 * load (visible-on-viewport behavior), the prefetch GET fired
 * `clearAdminSession()`, and the user was effectively signed out within a
 * second of landing on `/admin`.
 *
 * Reference headers:
 *   - `Sec-Purpose: prefetch` / `prefetch;prerender` — Fetch Metadata spec,
 *     emitted by Chrome/Edge for `<link rel="prefetch">` and speculation
 *     rules.
 *   - `Purpose: prefetch` — legacy header still used by some browsers.
 *   - `Next-Router-Prefetch: 1` — sent by Next.js's App Router prefetcher.
 *   - `X-Middleware-Prefetch: 1` — sent by Next.js's middleware prefetcher.
 *   - `X-Purpose: preview` — sent by link-preview scrapers (Slack, iMessage,
 *     etc.) that we definitely do not want triggering a logout.
 */
function isPrefetchRequest(req: Request): boolean {
  const secPurpose = req.headers.get("sec-purpose")?.toLowerCase() ?? "";
  if (secPurpose.includes("prefetch") || secPurpose.includes("prerender")) {
    return true;
  }
  const purpose = req.headers.get("purpose")?.toLowerCase() ?? "";
  if (purpose === "prefetch") return true;
  const xPurpose = req.headers.get("x-purpose")?.toLowerCase() ?? "";
  if (xPurpose === "prefetch" || xPurpose === "preview") return true;
  if (req.headers.get("next-router-prefetch")) return true;
  if (req.headers.get("x-middleware-prefetch")) return true;
  return false;
}

export async function GET(req: Request) {
  if (isPrefetchRequest(req)) {
    // eslint-disable-next-line no-console
    console.info("[admin-session] /admin/logout prefetch ignored");
    // 204 No Content satisfies the prefetcher without emitting a Set-Cookie.
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  await clearAdminSession();
  return buildHtmlRedirect(`${getPublicOrigin(req)}/admin/login`);
}
