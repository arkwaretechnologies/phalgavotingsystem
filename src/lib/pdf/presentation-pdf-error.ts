import "server-only";

import { toPublicMessage } from "@/lib/errors/public-message";

/** User-facing error for admin presentation PDF routes. */
export function presentationPdfPublicError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err && typeof (err as { message: unknown }).message === "string"
        ? String((err as { message: string }).message)
        : typeof err === "string"
          ? err
          : "";

  const lower = raw.toLowerCase();

  // Puppeteer / Chromium (e.g. "Could not find Chrome") must not become "Record not found."
  if (
    lower.includes("failed to launch") ||
    lower.includes("could not find chrome") ||
    lower.includes("browser process") ||
    lower.includes("puppeteer") ||
    lower.includes("chromium") ||
    (lower.includes("enoent") && lower.includes("chrome"))
  ) {
    return fallback;
  }

  if (lower.includes("could not find a relationship") || lower.includes("schema cache")) {
    return fallback;
  }

  return toPublicMessage(err, fallback).message;
}
