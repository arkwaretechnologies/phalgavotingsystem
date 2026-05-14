import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { jwtVerify } from "jose";

/**
 * Diagnostic endpoint for production session issues.
 *
 *   GET /admin/debug-session?key=<DEBUG_ADMIN_KEY>
 *
 * Returns JSON describing what cookies + headers the server actually receives,
 * whether the admin cookie is present, and whether `jwtVerify` succeeds.
 * Requires env `DEBUG_ADMIN_KEY` (server-only) to match the `key` query param.
 * Never enabled unless the env is set, so the endpoint is inert by default.
 */
const COOKIE_NAME = "phalga_admin_session";

function getSecret() {
  const raw = process.env.JWT_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  const secret = raw?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function GET(req: Request) {
  const expected = process.env.DEBUG_ADMIN_KEY?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, reason: "DEBUG_ADMIN_KEY not configured" }, { status: 404 });
  }
  const url = new URL(req.url);
  const provided = url.searchParams.get("key")?.trim();
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, reason: "bad key" }, { status: 401 });
  }

  const hdrs = await headers();
  const jar = await cookies();

  const rawCookieHeader = hdrs.get("cookie") ?? "";
  const cookieNames = jar.getAll().map((c) => c.name).sort();
  const adminCookieFromJar = jar.get(COOKIE_NAME)?.value ?? null;

  const secret = getSecret();
  let verify: { ok: boolean; reason?: string; payloadKeys?: string[] } = { ok: false };
  if (!secret) {
    verify = { ok: false, reason: "missing JWT_SECRET (or legacy ADMIN_SESSION_SECRET)" };
  } else if (!adminCookieFromJar) {
    verify = { ok: false, reason: "admin cookie not in jar" };
  } else {
    try {
      const { payload } = await jwtVerify(adminCookieFromJar, secret);
      verify = { ok: true, payloadKeys: Object.keys(payload).sort() };
    } catch (err) {
      const e = err as { code?: string; name?: string; message?: string };
      verify = { ok: false, reason: `verify failed: ${e.code ?? e.name ?? "?"} ${e.message ?? ""}`.trim() };
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasLegacyAdminSecret: Boolean(process.env.ADMIN_SESSION_SECRET),
    host: hdrs.get("host"),
    forwardedHost: hdrs.get("x-forwarded-host"),
    forwardedProto: hdrs.get("x-forwarded-proto"),
    cookieHeaderLength: rawCookieHeader.length,
    cookieNamesFromJar: cookieNames,
    cookieNamesFromHeader: rawCookieHeader
      .split(";")
      .map((s) => s.split("=")[0]?.trim())
      .filter(Boolean)
      .sort(),
    adminCookiePresent: Boolean(adminCookieFromJar),
    adminCookieLength: adminCookieFromJar?.length ?? 0,
    verify,
  });
}
