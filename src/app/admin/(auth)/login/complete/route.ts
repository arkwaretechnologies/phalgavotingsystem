import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_PATH,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  signAdminSessionToken,
  verifyLoginExchangeToken,
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

  const response = buildHtmlRedirect(`${origin}/admin?ok=login`);
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: ADMIN_SESSION_COOKIE_PATH,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  // eslint-disable-next-line no-console
  console.info(
    `[admin-session] GET set cookie user=${session.admin_user_id} role=${session.role_slug} token_len=${sessionToken.length} setcookie_present=${response.headers.has("set-cookie")}`,
  );
  return response;
}
