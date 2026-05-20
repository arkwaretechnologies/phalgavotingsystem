import "server-only";

import type { Browser, LaunchOptions } from "puppeteer-core";

function envFlagTruthy(name: string): boolean {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

function envFlagFalsy(name: string): boolean {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  return v === "0" || v === "false" || v === "no";
}

/** True when running in a containerized host where Chromium sandbox usually fails. */
function isLikelyContainerRuntime(): boolean {
  if (envFlagTruthy("PUPPETEER_ALLOW_NO_SANDBOX")) return true;
  if (envFlagFalsy("PUPPETEER_ALLOW_NO_SANDBOX")) return false;

  return Boolean(
    process.env.VERCEL ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_SERVICE_NAME ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.KUBERNETES_SERVICE_HOST ||
      process.env.DOCKER ||
      process.env.CONTAINER ||
      process.env.CI,
  );
}

/**
 * Vercel/AWS Lambda cannot run Puppeteer's downloaded Chrome; use the
 * serverless Chromium binary instead. Override with `PDF_CHROMIUM_MODE=local|serverless`.
 */
function shouldUseServerlessChromium(): boolean {
  const mode = (process.env.PDF_CHROMIUM_MODE ?? "").toLowerCase().trim();
  if (mode === "serverless") return true;
  if (mode === "local") return false;
  return Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV);
}

/**
 * Build Puppeteer launch options for PDF generation on hosts with a local Chrome
 * install (dev machine, Railway with system Chromium, etc.).
 */
export function buildPuppeteerLaunchOptions(extra?: LaunchOptions): LaunchOptions {
  const useNoSandbox = isLikelyContainerRuntime();
  const containerArgs = useNoSandbox
    ? [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ]
    : [];

  const userArgs = extra?.args ?? [];
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();

  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    ...extra,
    args: [...containerArgs, ...userArgs],
  };
}

async function launchWithServerlessChromium(): Promise<Browser> {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = await import("puppeteer-core");

  chromium.setGraphicsMode = false;

  return puppeteer.default.launch({
    args: puppeteer.default.defaultArgs({
      args: chromium.args,
      headless: "shell",
    }),
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
}

async function launchWithLocalChrome(): Promise<Browser> {
  const puppeteer = await import("puppeteer");
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || puppeteer.default.executablePath();

  return puppeteer.default.launch(
    buildPuppeteerLaunchOptions({ executablePath }),
  ) as Promise<Browser>;
}

/** Launch headless Chromium for HTML → PDF (Vercel, Railway, or local dev). */
export async function launchPdfBrowser(): Promise<Browser> {
  if (shouldUseServerlessChromium()) {
    return launchWithServerlessChromium();
  }
  return launchWithLocalChrome();
}
