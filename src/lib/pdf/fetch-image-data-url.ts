import "server-only";

const PHOTO_FETCH_TIMEOUT_MS = 8_000;
/** Max download size per image. */
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
/** Skip inlining above this size to keep Puppeteer HTML under memory limits. */
export const PHOTO_INLINE_MAX_BYTES = 400 * 1024;

/**
 * Download a remote image and convert it to a data: URL for PDF HTML.
 * Returns `null` on failure or when the image is too large to inline safely.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;

    const lenHeader = res.headers.get("content-length");
    const declaredLen = lenHeader ? Number(lenHeader) : NaN;
    if (Number.isFinite(declaredLen) && declaredLen > PHOTO_MAX_BYTES) return null;

    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > PHOTO_MAX_BYTES) return null;
    if (buf.byteLength > PHOTO_INLINE_MAX_BYTES) return null;

    const mime =
      contentType && contentType.startsWith("image/")
        ? contentType
        : (() => {
            const lower = url.toLowerCase();
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".gif")) return "image/gif";
            return "image/jpeg";
          })();

    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
