import "server-only";

import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { shouldUseSecureCookies } from "@/lib/security/cookies";

const COOKIE_NAME = "phalga_tablet_session";
const COOKIE_PATH = "/";
/** 24h — covers a full election day on a single paired device. */
const TABLET_SESSION_TTL_SECONDS = 60 * 60 * 24;

export type TabletSessionPayload = {
  tablet_id: number;
  device_id: string;
};

function getSecret() {
  const raw = process.env.JWT_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  const secret = raw?.trim();
  if (!secret) {
    throw new Error("Missing env: JWT_SECRET (or legacy ADMIN_SESSION_SECRET)");
  }
  return new TextEncoder().encode(secret);
}

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

export async function signTabletSessionToken(payload: TabletSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${TABLET_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyTabletSessionToken(
  token: string,
): Promise<TabletSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const tablet_id = Number((payload as { tablet_id?: unknown }).tablet_id);
    const device_id = (payload as { device_id?: unknown }).device_id;
    if (!Number.isFinite(tablet_id) || tablet_id <= 0) return null;
    if (typeof device_id !== "string" || !device_id.trim()) return null;
    return { tablet_id, device_id: device_id.trim() };
  } catch {
    return null;
  }
}

export async function setTabletSessionCookie(payload: TabletSessionPayload) {
  const token = await signTabletSessionToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: COOKIE_PATH,
    maxAge: TABLET_SESSION_TTL_SECONDS,
  });
}

export async function clearTabletSessionCookie() {
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: COOKIE_PATH });
}

export async function getTabletSession(): Promise<TabletSessionPayload | null> {
  const store = await cookies();
  let token = store.get(COOKIE_NAME)?.value ?? null;
  if (!token) {
    const rawCookie = (await headers()).get("cookie");
    token = tokenFromRawCookieHeader(rawCookie);
  }
  if (!token) return null;
  return verifyTabletSessionToken(token);
}

/**
 * Verify that the caller holds a tablet session cookie whose `tablet_id`
 * matches the id supplied in the request. Returns the payload on success or
 * `null` on mismatch / missing cookie — caller decides how to react.
 */
export async function getTabletSessionMatching(
  tabletId: number,
): Promise<TabletSessionPayload | null> {
  if (!Number.isFinite(tabletId) || tabletId <= 0) return null;
  const session = await getTabletSession();
  if (!session) return null;
  if (session.tablet_id !== tabletId) return null;
  return session;
}

export const TABLET_SESSION_COOKIE_NAME = COOKIE_NAME;
