import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "phalga_admin_session";
const COOKIE_PATH = "/";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const EXCHANGE_TTL = "60s";
const EXCHANGE_PURPOSE = "login-exchange";

/** Pull a name=value pair from a raw `Cookie` header (fallback when `cookies().get` misses in some proxies). */
function tokenFromRawCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(";")) {
    const part = segment.trim();
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    if (k !== COOKIE_NAME) continue;
    const v = part.slice(eq + 1).trim();
    return v || null;
  }
  return null;
}

/**
 * - `is_full_access`: role grants every admin page; runtime ignores `role_pages`.
 * - `role_slug` `super_admin` is the system “super” that may manage users and role presets.
 */
export type AdminSessionPayload = {
  admin_user_id: number;
  admin_role_id: number;
  role_slug: string;
  is_full_access: boolean;
  full_name?: string | null;
};

function getSecret() {
  const raw = process.env.JWT_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  const secret = raw?.trim();
  if (!secret) {
    throw new Error("Missing env: JWT_SECRET (or legacy ADMIN_SESSION_SECRET)");
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Sign / verify primitives
// ---------------------------------------------------------------------------

/** Sign the long-lived (12h) admin session JWT. Does NOT write any cookie. */
export async function signAdminSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

/** Verify a session JWT string and return the parsed payload (or null). */
export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return parseSessionPayload(payload as Record<string, unknown>);
  } catch (err) {
    const code = (err as { code?: string; name?: string }).code
      ?? (err as { name?: string }).name
      ?? "unknown";
    const msg = (err as Error).message ?? "";
    // eslint-disable-next-line no-console
    console.warn(`[admin-session] jwtVerify failed code=${code} msg=${msg}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie read / write / clear
// ---------------------------------------------------------------------------

/** Write the session token to the response cookie store. Separate from signing. */
export async function writeAdminSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: SESSION_TTL_SECONDS,
  });
  // Diagnostic: should fire only at /admin/login/complete. Any other call site
  // would indicate a stray re-write that could clobber the cookie attributes.
  // eslint-disable-next-line no-console
  console.info(`[admin-session] writeAdminSessionCookie called (token_len=${token.length})`);
}

/** Sign a session payload and persist it as a cookie in one step. */
export async function setAdminSession(payload: AdminSessionPayload) {
  const token = await signAdminSessionToken(payload);
  await writeAdminSessionCookie(token);
  // eslint-disable-next-line no-console
  console.info(
    `[admin-session] set cookie user=${payload.admin_user_id} role=${payload.role_slug} token_len=${token.length}`,
  );
}

export async function clearAdminSession() {
  // Diagnostic: clearAdminSession should fire ONLY from /admin/logout. If we
  // ever see this log without a user-initiated logout, something is wiping the
  // session unexpectedly. The stack trace pinpoints the call site.
  // eslint-disable-next-line no-console
  console.warn("[admin-session] clearAdminSession called", new Error("trace").stack);
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: COOKIE_PATH });
}

function parseSessionPayload(payload: Record<string, unknown>): AdminSessionPayload | null {
  const admin_user_id = Number(payload.admin_user_id);
  const admin_role_id = Number((payload as { admin_role_id?: unknown }).admin_role_id);
  const role_slug = (payload as { role_slug?: unknown }).role_slug;
  const is_full_access = (payload as { is_full_access?: unknown }).is_full_access;

  if (!Number.isFinite(admin_user_id) || admin_user_id <= 0) return null;
  if (!Number.isFinite(admin_role_id) || admin_role_id <= 0) return null;
  if (typeof role_slug !== "string" || !role_slug.trim()) return null;
  if (typeof is_full_access !== "boolean") return null;

  return {
    admin_user_id,
    admin_role_id,
    role_slug: role_slug.trim(),
    is_full_access,
    full_name: typeof payload.full_name === "string" ? payload.full_name : null,
  };
}

/**
 * Returns null if the cookie is missing, invalid, or a pre–dynamic-roles token (re-login required).
 *
 * Includes a raw-`Cookie`-header fallback because Railway's edge has been
 * observed to omit cookies from `cookies().get()` on some routes despite
 * sending them on the wire.
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  let token = store.get(COOKIE_NAME)?.value ?? null;
  let source: "store" | "raw" | "missing" = token ? "store" : "missing";
  if (!token) {
    const rawCookie = (await headers()).get("cookie");
    token = tokenFromRawCookieHeader(rawCookie);
    if (token) source = "raw";
  }
  if (!token) {
    // eslint-disable-next-line no-console
    console.warn("[admin-session] no token in request");
    return null;
  }

  const parsed = await verifyAdminSessionToken(token);
  if (!parsed) {
    // eslint-disable-next-line no-console
    console.warn(`[admin-session] verify failed or payload invalid (source=${source})`);
  }
  return parsed;
}

/**
 * Auth gate for admin pages/layouts. Returns the session when valid; otherwise
 * redirects to the admin login. Optionally enforces a role-slug allowlist —
 * when set and the session's `role_slug` is not in the list, the user is sent
 * to the admin home with `?error=forbidden`.
 *
 *   const session = await requireAdminSession();
 *   const session = await requireAdminSession({ roles: ["super_admin"] });
 */
export async function requireAdminSession(opts?: {
  roles?: string[];
  loginPath?: string;
  forbiddenPath?: string;
}): Promise<AdminSessionPayload> {
  const loginPath = opts?.loginPath ?? "/admin/login";
  const forbiddenPath = opts?.forbiddenPath ?? "/admin?error=forbidden";

  const session = await getAdminSession();
  if (!session) {
    redirect(loginPath);
  }
  if (opts?.roles && !opts.roles.includes(session.role_slug)) {
    redirect(forbiddenPath);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Login-exchange token (POST → GET handoff; see /admin/login/submit + /complete)
// ---------------------------------------------------------------------------

/**
 * Sign a short-lived (60s) token that carries an authenticated identity from
 * the POST credentials-check step over to the GET cookie-set step. The
 * `purpose` claim prevents this token from being accepted as a session JWT.
 */
export async function signLoginExchangeToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: EXCHANGE_PURPOSE })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(EXCHANGE_TTL)
    .sign(getSecret());
}

/** Verify an exchange token and return its inner session payload (or null). */
export async function verifyLoginExchangeToken(
  xt: string,
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(xt, getSecret());
    if ((payload as { purpose?: unknown }).purpose !== EXCHANGE_PURPOSE) return null;
    return parseSessionPayload(payload as Record<string, unknown>);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-session] exchange verify failed", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ADMIN_SESSION_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_COOKIE_PATH = COOKIE_PATH;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;
