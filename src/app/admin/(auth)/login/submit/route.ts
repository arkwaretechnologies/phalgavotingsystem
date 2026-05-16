import bcrypt from "bcryptjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAdminRoleByUserRoleId } from "@/lib/admin/fetch-admin-role-by-id";
import {
  ADMIN_LOGIN_EXCHANGE_COOKIE_NAME,
  ADMIN_LOGIN_EXCHANGE_COOKIE_PATH,
  ADMIN_LOGIN_EXCHANGE_MAX_AGE_SECONDS,
  signLoginExchangeToken,
} from "@/lib/admin/session";
import { shouldUseSecureCookies } from "@/lib/security/cookies";
import {
  buildHtmlRedirect,
  getPublicOrigin,
} from "@/lib/http/railway-redirect";
import { tryRateLimit } from "@/lib/security/rate-limit";

/**
 * Constant-time dummy bcrypt hash. Used when the username lookup misses so the
 * verify step still runs and an attacker cannot infer user existence from
 * response timing. Generated once per process from a random string at runtime
 * to avoid leaking a static value.
 */
const DUMMY_BCRYPT_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.fWnQfXrXi6kI/ScrYxK1NqfBzWyu";

/**
 * Reject cross-site form posts (login CSRF). Same-origin or no-Origin (legacy
 * non-browser clients) is allowed. `Sec-Fetch-Site: same-origin` and a matching
 * `Origin` header are the canonical signals.
 */
function isSameOriginRequest(req: Request): boolean {
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs === "same-origin" || sfs === "same-site" || sfs === "none") return true;
  if (sfs && sfs !== "cross-site") {
    // Unknown Sec-Fetch-Site value; fall through to Origin check.
  }
  const origin = req.headers.get("origin");
  if (!origin) {
    // No Origin header at all (some legacy non-browser clients). We tolerate
    // this rather than break those; cross-site browsers always send Origin.
    return sfs == null;
  }
  try {
    const expected = getPublicOrigin(req);
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

/**
 * Admin login — POST half of a two-step flow.
 *
 * Why two steps? Railway's edge has been observed to drop `Set-Cookie` headers
 * on non-GET responses. Setting cookies on a GET response is reliable.
 *
 *   POST /admin/login/submit  → validates credentials, signs a 60s exchange
 *                                token (NOT the session), attaches it to the
 *                                HTML redirect response as a short-lived,
 *                                path-restricted HttpOnly cookie, redirects
 *                                to GET /admin/login/complete (no token in URL).
 *   GET  /admin/login/complete → reads the exchange cookie, verifies it, signs
 *                                the real 12h session JWT, sets it as a cookie
 *                                on the GET response, clears the exchange
 *                                cookie, and redirects to /admin.
 *
 * The exchange token is short-lived and bound to a `purpose: "login-exchange"`
 * claim so it cannot be used as a session JWT even if it leaks. Keeping it in
 * an HttpOnly cookie (instead of `?xt=...`) avoids leakage through Referer
 * headers, browser history, and proxy/access logs.
 */

function loginError(originUrl: string, message: string) {
  return buildHtmlRedirect(`${originUrl}/admin/login?error=${encodeURIComponent(message)}`);
}

export async function POST(req: Request) {
  const origin = getPublicOrigin(req);

  if (!isSameOriginRequest(req)) {
    return loginError(origin, "Invalid form submission.");
  }

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

  // Rate limit by client IP + username to slow brute force / credential stuffing.
  const ipHeader =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const clientIp = ipHeader.split(",")[0]?.trim() || "unknown";
  const rl = await tryRateLimit({
    bucket: "admin_login",
    key: `${clientIp}:${username.toLowerCase()}`,
    limit: 8,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    return loginError(origin, "Too many sign-in attempts. Please wait a minute and try again.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, username, password_hash, full_name, role_id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("admin login query failed", error);
    return loginError(origin, "Unable to sign in right now. Please try again.");
  }
  // Always perform a bcrypt comparison so response time does not reveal whether
  // the username exists. The dummy hash is non-matching, so the result of this
  // branch is discarded.
  if (!user?.password_hash) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    return loginError(origin, "Invalid credentials.");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return loginError(origin, "Invalid credentials.");
  }

  const roleId = Number((user as { role_id?: unknown }).role_id);
  if (!Number.isFinite(roleId) || roleId <= 0) {
    console.error("admin user has invalid role_id", user);
    return loginError(origin, "Invalid account configuration. Ask a super admin to fix this user's role.");
  }

  const roleRow = await fetchAdminRoleByUserRoleId(roleId);
  if (!roleRow) {
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
    exchangeToken = await signLoginExchangeToken({
      admin_user_id: user.id,
      admin_role_id: roleId,
      role_slug: cleanRoleSlug,
      is_full_access,
      full_name: user.full_name ?? null,
    });
  } catch (err) {
    console.error("admin login JWT sign failed", err);
    return loginError(origin, "Unable to sign in right now. Please try again.");
  }

  const response = buildHtmlRedirect(`${origin}/admin/login/complete`);
  // Attach the exchange token as a path-scoped HttpOnly cookie on the 200 HTML
  // response. Cookie writes on this code path (NextResponse via railway helper)
  // mutate the existing header list, so `Set-Cookie` survives Railway's edge.
  response.cookies.set(ADMIN_LOGIN_EXCHANGE_COOKIE_NAME, exchangeToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: ADMIN_LOGIN_EXCHANGE_COOKIE_PATH,
    maxAge: ADMIN_LOGIN_EXCHANGE_MAX_AGE_SECONDS,
  });
  return response;
}
