import "server-only";

const PHOTO_FETCH_TIMEOUT_MS = 12_000;
/** Max download size per image. */
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
/** Default cap when inlining into HTML (presentation PDFs). */
export const PHOTO_INLINE_MAX_BYTES = 400 * 1024;

export type FetchImageAsDataUrlOptions = {
  /** Max bytes to inline; larger images return null so callers can use the remote URL. */
  maxInlineBytes?: number;
  /** Try Supabase Storage image transform at this width before the raw object URL. */
  supabaseTransformWidth?: number;
  /** Supabase transform resize mode (default `cover` crops; use `contain` to avoid zoom/crop). */
  supabaseTransformResize?: "cover" | "contain";
};

/**
 * Build a Supabase Storage render URL from a public object URL.
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */
export function supabaseStorageTransformUrl(
  publicObjectUrl: string,
  width: number,
  resize: "cover" | "contain" = "cover",
): string | null {
  try {
    const u = new URL(publicObjectUrl);
    if (!u.pathname.includes("/storage/v1/object/public/")) return null;
    u.pathname = u.pathname.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    u.search = "";
    u.searchParams.set("width", String(Math.max(64, Math.round(width))));
    u.searchParams.set("resize", resize);
    u.searchParams.set("quality", "85");
    return u.toString();
  } catch {
    return null;
  }
}

async function downloadImageBuffer(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
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

    return { buf, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mimeFromUrl(url: string, contentType: string) {
  if (contentType && contentType.startsWith("image/")) return contentType;
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

/**
 * Download a remote image and convert it to a data: URL for PDF HTML.
 * Returns `null` on failure or when the image is too large to inline; callers
 * should keep the original `photo_url` and let Puppeteer load it over the network.
 */
export async function fetchImageAsDataUrl(
  url: string,
  opts?: FetchImageAsDataUrlOptions,
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  const maxInline = opts?.maxInlineBytes ?? PHOTO_INLINE_MAX_BYTES;
  const urlsToTry: string[] = [];
  if (opts?.supabaseTransformWidth) {
    const transformed = supabaseStorageTransformUrl(
      url,
      opts.supabaseTransformWidth,
      opts.supabaseTransformResize ?? "cover",
    );
    if (transformed) urlsToTry.push(transformed);
  }
  urlsToTry.push(url);

  for (const tryUrl of urlsToTry) {
    const downloaded = await downloadImageBuffer(tryUrl);
    if (!downloaded) continue;
    if (downloaded.buf.byteLength > maxInline) continue;

    const mime = mimeFromUrl(tryUrl, downloaded.contentType);
    return `data:${mime};base64,${downloaded.buf.toString("base64")}`;
  }

  return null;
}
