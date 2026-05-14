import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

/**
 * Admin login — GET half of the two-step flow (see ./submit/route.ts).
 *
 * Accepts a short-lived exchange JWT in `?xt=...`, verifies it, then issues the
 * real 12h session JWT and sets it as a cookie on this GET response. Cookies on
 * GET responses are confirmed to traverse Railway's edge (proven by
 * `phalga_debug_secure` in `/admin/debug-session`).
 */

const COOKIE_NAME = "phalga_admin_session";

function getSecret() {
  const raw = process.env.JWT_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  const secret = raw?.trim();
  if (!secret) {
    throw new Error("Missing env: JWT_SECRET (or legacy ADMIN_SESSION_SECRET)");
  }
  return new TextEncoder().encode(secret);
}

function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost || req.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}

/** Same HTML-redirect helper as `submit/route.ts` (keeps Set-Cookie alive on 200). */
function buildHtmlRedirect(target: string): NextResponse {
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

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(xt, getSecret());
    payload = verified.payload as Record<string, unknown>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-session] exchange verify failed", err);
    return loginError(origin, "Login link expired. Please sign in again.");
  }

  if (payload.purpose !== "login-exchange") {
    return loginError(origin, "Invalid login token.");
  }

  const admin_user_id = Number(payload.admin_user_id);
  const admin_role_id = Number(payload.admin_role_id);
  const role_slug = typeof payload.role_slug === "string" ? payload.role_slug.trim() : "";
  const is_full_access = Boolean(payload.is_full_access);
  const full_name = typeof payload.full_name === "string" ? payload.full_name : null;

  if (!Number.isFinite(admin_user_id) || admin_user_id <= 0
    || !Number.isFinite(admin_role_id) || admin_role_id <= 0
    || !role_slug) {
    return loginError(origin, "Login token is missing required fields.");
  }

  let sessionToken: string;
  try {
    sessionToken = await new SignJWT({
      admin_user_id,
      admin_role_id,
      role_slug,
      is_full_access,
      full_name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(getSecret());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-session] session JWT sign failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return loginError(origin, `session error: ${msg}`);
  }

  const response = buildHtmlRedirect(`${origin}/admin?ok=login`);
  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  // eslint-disable-next-line no-console
  console.info(
    `[admin-session] GET set cookie user=${admin_user_id} role=${role_slug} token_len=${sessionToken.length} setcookie_present=${response.headers.has("set-cookie")}`,
  );
  return response;
}
