import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin/session";

/** Build the public origin from forwarded headers so Railway/reverse-proxy redirects keep the user on the real host. */
function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost || req.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  await clearAdminSession();
  return NextResponse.redirect(new URL("/admin/login", getPublicOrigin(req)));
}

