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
 * Accepts a short-lived exchange JWT in `?xt=...`, verifies it, then issues the
 * real 12h session JWT and sets it as a cookie on this GET response. Cookies on
 * GET responses are confirmed to traverse Railway's edge (proven by
 * `phalga_debug_secure` in `/admin/debug-session`).
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
    // eslint-disable-next-line no-console
    console.error("[admin-session] session JWT sign failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return loginError(origin, `session error: ${msg}`);
  }

  // IMPORTANT: write via the framework's request-side cookie store (`cookies()`
  // from `next/headers`) — NOT `response.cookies.set()` on a custom NextResponse.
  // The custom-Response path emits `Set-Cookie` on the object but it does not
  // survive Next.js 16's response pipeline reliably (we observed
  // `setcookie_present=true` server-side while the browser never received it).
  // `cookies().set()` is the same path used by `/admin/debug-session` for
  // `phalga_debug_secure`, which is proven to reach the browser through Railway.
  await writeAdminSessionCookie(sessionToken);

  // eslint-disable-next-line no-console
  console.info(
    `[admin-session] GET set cookie user=${session.admin_user_id} role=${session.role_slug} token_len=${sessionToken.length}`,
  );
  return buildHtmlRedirect(`${origin}/admin?ok=login`);
}
