import "server-only";

import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "phalga_admin_session";
const COOKIE_PATH = "/";

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

export async function setAdminSession(payload: AdminSessionPayload) {
  const token = await new SignJWT({
    ...payload,
    is_full_access: payload.is_full_access,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
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
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  let token = store.get(COOKIE_NAME)?.value ?? null;
  if (!token) {
    const rawCookie = (await headers()).get("cookie");
    token = tokenFromRawCookieHeader(rawCookie);
  }
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as Record<string, unknown>;
    return parseSessionPayload(p);
  } catch {
    return null;
  }
}
