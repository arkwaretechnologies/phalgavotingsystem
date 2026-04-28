import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "phalga_final_tally_grant";

type GrantPayload = {
  admin_user_id: number;
};

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing env: ADMIN_SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setFinalTallyGrant(adminUserId: number) {
  const token = await new SignJWT({ admin_user_id: adminUserId } satisfies GrantPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
}

export async function hasFinalTallyGrant(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const admin_user_id = Number((payload as Record<string, unknown>).admin_user_id);
    return Number.isFinite(admin_user_id) && admin_user_id > 0;
  } catch {
    return false;
  }
}

