import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAdminRoleByUserRoleId } from "@/lib/admin/fetch-admin-role-by-id";
import { toPublicMessage } from "@/lib/errors/public-message";

/**
 * Admin login — POST half of a two-step flow.
 *
 * Why two steps? Railway's edge appears to drop `Set-Cookie` headers on
 * non-GET responses (we observed the cookie being emitted in the response
 * but never reaching the browser, while identical cookies on GET responses
 * via `/admin/debug-session` persisted fine).
 *
 *   POST /admin/login/submit  → validates credentials, signs a 60s exchange
 *                                token (NOT the session), redirects (HTML 200)
 *                                to GET /admin/login/complete?xt=<token>
 *   GET  /admin/login/complete → verifies the exchange token, signs the real
 *                                12h session JWT, sets it as a cookie on the
 *                                GET response, redirects to /admin.
 *
 * The exchange token is short-lived and bound to a `purpose: "login-exchange"`
 * claim so it cannot be used as a session JWT even if it leaks.
 */

function getSecret() {
  const raw = process.env.JWT_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  const secret = raw?.trim();
  if (!secret) {
    throw new Error("Missing env: JWT_SECRET (or legacy ADMIN_SESSION_SECRET)");
  }
  return new TextEncoder().encode(secret);
}

/**
 * On Railway / behind a reverse proxy, `req.url` is the internal upstream URL
 * (e.g. `http://localhost:8080`). Honor `x-forwarded-host` / `x-forwarded-proto`
 * so the redirect goes to the public origin the browser actually used.
 */
function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost || req.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}

/**
 * Build an HTML "redirect" response (200 OK). Returns the NextResponse so callers
 * can attach cookies via `response.cookies.set(...)` AFTER construction — that
 * mutates the response's internal headers list rather than overwriting it.
 */
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

export async function POST(req: Request) {
  const origin = getPublicOrigin(req);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return loginError(origin, "Invalid form submission.");
  }

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return loginError(origin, "Username and password are required.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, username, password_hash, full_name, role_id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("admin login query failed", error);
    const { message } = toPublicMessage(error, "Unable to sign in right now. Please try again.");
    return loginError(origin, message);
  }
  if (!user?.password_hash) {
    return loginError(origin, "Invalid credentials.");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return loginError(origin, "Invalid credentials.");
  }

  const roleId = Number((user as { role_id?: unknown }).role_id);
  if (!Number.isFinite(roleId) || roleId <= 0) {
    // eslint-disable-next-line no-console
    console.error("admin user has invalid role_id", user);
    return loginError(origin, "Invalid account configuration. Ask a super admin to fix this user's role.");
  }

  const roleRow = await fetchAdminRoleByUserRoleId(roleId);
  if (!roleRow) {
    // eslint-disable-next-line no-console
    console.error("admin role missing for role_id", roleId);
    return loginError(
      origin,
      "This account's role was not found. Apply pending migrations or fix admin_users.role_id.",
    );
  }

  const role_slug = roleRow.slug;
  const is_full_access = roleRow.is_full_access;
  if (!role_slug) {
    return loginError(origin, "Invalid account role.");
  }

  // Trim any stray CR/LF in role_slug coming from the DB so it doesn't end up
  // as control characters inside the JWT payload.
  const cleanRoleSlug = String(role_slug).trim();

  let exchangeToken: string;
  try {
    exchangeToken = await new SignJWT({
      purpose: "login-exchange",
      admin_user_id: user.id,
      admin_role_id: roleId,
      role_slug: cleanRoleSlug,
      is_full_access,
      full_name: user.full_name ?? null,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(getSecret());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("admin login JWT sign failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return loginError(origin, `session error: ${msg}`);
  }

  // eslint-disable-next-line no-console
  console.info(
    `[admin-session] credentials ok user=${user.id} role=${cleanRoleSlug}, redirecting to /admin/login/complete`,
  );
  return buildHtmlRedirect(
    `${origin}/admin/login/complete?xt=${encodeURIComponent(exchangeToken)}`,
  );
}
