import {
  signAdminSessionToken,
  verifyLoginExchangeToken,
  writeAdminSessionCookie,
} from "@/lib/admin/session";
import {
  buildHtmlRedirect,
  getPublicOrigin,
} from "@/lib/http/railway-redirect";

/**
 * Admin login — GET half of the two-step flow (see ./submit/route.ts).
 *
 * Accepts a short-lived exchange JWT in `?xt=...`, verifies it, then issues
 * the real 12h session JWT and sets it as a cookie on this GET response. The
 * cookie is written via `cookies()` from `next/headers` (NOT
 * `response.cookies.set` on a custom NextResponse) so Next.js's response
 * pipeline serializes the `Set-Cookie` header reliably through Railway's edge.
 */

function loginError(originUrl: string, message: string) {
  return buildHtmlRedirect(`${originUrl}/admin/login?error=${encodeURIComponent(message)}`);
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const url = new URL(req.url);
  const xt = url.searchParams.get("xt");
  if (!xt) {
    return loginError(origin, "Missing login exchange token.");
  }

  const session = await verifyLoginExchangeToken(xt);
  if (!session) {
    return loginError(origin, "Login link expired. Please sign in again.");
  }

  let sessionToken: string;
  try {
    sessionToken = await signAdminSessionToken(session);
  } catch (err) {
    console.error("[admin-session] session JWT sign failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return loginError(origin, `session error: ${msg}`);
  }

  await writeAdminSessionCookie(sessionToken);
  return buildHtmlRedirect(`${origin}/admin`);
}
