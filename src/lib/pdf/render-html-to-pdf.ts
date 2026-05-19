import "server-only";

import puppeteer, { type Page } from "puppeteer";
import { buildPuppeteerLaunchOptions } from "@/lib/pdf/puppeteer-launch";

export type LandscapePdfOptions = {
  width?: string;
  height?: string;
  timeoutMs?: number;
  /** Wait for `<img>` elements (remote URLs) before printing. */
  waitForImages?: boolean;
};

const DEFAULT_TIMEOUT_MS = 60_000;

async function waitForDocumentImages(page: Page, timeoutMs: number) {
  const imageWaitMs = Math.min(timeoutMs, 30_000);
  await page.evaluate((waitMs) => {
    const imgs = Array.from(document.images);
    return Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, waitMs);
          }),
      ),
    );
  }, imageWaitMs);
}

/**
 * Render HTML to a landscape PDF buffer via headless Chromium.
 * When `waitForImages` is true, uses `load` and waits for images (needed for
 * remote Supabase photo URLs that were not inlined as data: URLs).
 */
export async function renderHtmlToLandscapePdfBuffer(
  html: string,
  opts?: LandscapePdfOptions,
): Promise<Buffer> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const width = opts?.width ?? "297mm";
  const height = opts?.height ?? "210mm";
  const waitForImages = opts?.waitForImages ?? false;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(buildPuppeteerLaunchOptions());
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);
    await page.setContent(html, {
      waitUntil: waitForImages ? "load" : "domcontentloaded",
      timeout: timeoutMs,
    });
    if (waitForImages) {
      await waitForDocumentImages(page, timeoutMs);
    }
    const pdf = await page.pdf({
      width,
      height,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    return Buffer.from(pdf);
  } finally {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}
