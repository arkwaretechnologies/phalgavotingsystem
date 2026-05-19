import "server-only";

import puppeteer, { type LaunchOptions } from "puppeteer";

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
 * Build Puppeteer launch options for PDF generation.
 *
 * Chromium's sandbox limits blast radius of an in-process RCE. Container hosts
 * (Railway, Docker, many CI runners) often cannot use the sandbox — we auto-detect
 * those environments and pass `--no-sandbox` plus common stability flags.
 *
 * Override with `PUPPETEER_ALLOW_NO_SANDBOX=true|false` and optional
 * `PUPPETEER_EXECUTABLE_PATH`.
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
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || puppeteer.executablePath();

  return {
    headless: true,
    executablePath,
    ...extra,
    args: [...containerArgs, ...userArgs],
  };
}
