import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "phalga_admin_session";

type AdminSessionPayload = {
  admin_user_id: number;
  role: "super_admin" | "admin" | "personnel";
  full_name?: string | null;
};

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing env: ADMIN_SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setAdminSession(payload: AdminSessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const admin_user_id = Number(payload.admin_user_id);
    const role = payload.role;
    if (!Number.isFinite(admin_user_id) || admin_user_id <= 0) return null;
    if (role !== "super_admin" && role !== "admin" && role !== "personnel") return null;
    return {
      admin_user_id,
      role,
      full_name: typeof payload.full_name === "string" ? payload.full_name : null,
    };
  } catch {
    return null;
  }
}

