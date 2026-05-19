import "server-only";

import puppeteer from "puppeteer";
import { buildPuppeteerLaunchOptions } from "@/lib/pdf/puppeteer-launch";

export type LandscapePdfOptions = {
  width?: string;
  height?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Render HTML to a landscape PDF buffer via headless Chromium.
 * Uses `domcontentloaded` (no external network) and does not wait on web fonts.
 */
export async function renderHtmlToLandscapePdfBuffer(
  html: string,
  opts?: LandscapePdfOptions,
): Promise<Buffer> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const width = opts?.width ?? "297mm";
  const height = opts?.height ?? "210mm";

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(buildPuppeteerLaunchOptions());
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: timeoutMs });
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
