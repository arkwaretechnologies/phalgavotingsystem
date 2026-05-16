import {
  clearLoginExchangeCookie,
  getLoginExchangeCookieValue,
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
 * Reads a short-lived exchange JWT from a path-scoped HttpOnly cookie set by
 * the POST step (the token is no longer carried in the URL), verifies it,
 * issues the 12h session JWT, sets it as a cookie on this GET response, and
 * clears the exchange cookie. The cookie is written via `cookies()` from
 * `next/headers` (NOT `response.cookies.set` on a custom NextResponse) so
 * Next.js's response pipeline serializes the `Set-Cookie` header reliably
 * through Railway's edge.
 */

function loginError(originUrl: string, message: string) {
  return buildHtmlRedirect(`${originUrl}/admin/login?error=${encodeURIComponent(message)}`);
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);

  const xt = await getLoginExchangeCookieValue();
  if (!xt) {
    return loginError(origin, "Login link expired. Please sign in again.");
  }

  const session = await verifyLoginExchangeToken(xt);
  // Always clear the exchange cookie, success or failure, so it cannot be
  // replayed.
  await clearLoginExchangeCookie();

  if (!session) {
    return loginError(origin, "Login link expired. Please sign in again.");
  }

  let sessionToken: string;
  try {
    sessionToken = await signAdminSessionToken(session);
  } catch (err) {
    console.error("[admin-session] session JWT sign failed", err);
    return loginError(origin, "Unable to sign in right now. Please try again.");
  }

  await writeAdminSessionCookie(sessionToken);
  return buildHtmlRedirect(`${origin}/admin`);
}
