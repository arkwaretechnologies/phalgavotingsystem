import bcrypt from "bcryptjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchAdminRoleByUserRoleId } from "@/lib/admin/fetch-admin-role-by-id";
import { toPublicMessage } from "@/lib/errors/public-message";
import { signLoginExchangeToken } from "@/lib/admin/session";
import {
  buildHtmlRedirect,
  getPublicOrigin,
} from "@/lib/http/railway-redirect";

/**
 * Admin login — POST half of a two-step flow.
 *
 * Why two steps? Railway's edge has been observed to drop `Set-Cookie` headers
 * on non-GET responses. Setting cookies on a GET response is reliable.
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
    const msg = err instanceof Error ? err.message : String(err);
    return loginError(origin, `session error: ${msg}`);
  }

  return buildHtmlRedirect(
    `${origin}/admin/login/complete?xt=${encodeURIComponent(exchangeToken)}`,
  );
}
