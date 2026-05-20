import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every route. CSP is intentionally
 * permissive on inline styles/scripts because the app uses Next.js streaming
 * and inline scripts for hydration; tightening to nonce-based CSP can be done
 * once a CSP report-only rollout has been observed. `frame-ancestors 'none'`
 * blocks clickjacking; HSTS only kicks in on HTTPS responses (browser ignores
 * on plain HTTP).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Inline + eval used by Next.js runtime; Geist fonts served from same origin via next/font.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Allow Supabase storage URLs and inline data: URIs (used by QR images & PDF rendering).
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Supabase realtime + REST + Resend API calls.
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  allowedDevOrigins: ["untensing-heike-burdensome.ngrok-free.dev"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
