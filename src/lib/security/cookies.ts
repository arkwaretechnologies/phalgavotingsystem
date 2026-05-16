import "server-only";

/**
 * Decide whether to set the `Secure` cookie attribute. Production builds
 * always require it. Non-production builds opt-in via `FORCE_SECURE_COOKIES`
 * so HTTPS staging / preview envs can still receive cookies in browsers.
 */
export function shouldUseSecureCookies(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const v = (process.env.FORCE_SECURE_COOKIES ?? "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}
