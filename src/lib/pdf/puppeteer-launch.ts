import "server-only";

import type { LaunchOptions } from "puppeteer";

/**
 * Build Puppeteer launch options for PDF generation.
 *
 * Background: Chromium's sandbox dramatically limits the blast radius of an
 * in-process RCE. We default to sandboxed mode and only pass `--no-sandbox`
 * when the runtime explicitly opts in. Some hosting environments (e.g.
 * containerized Linux without user namespaces) cannot run the sandbox, so
 * operators flip `PUPPETEER_ALLOW_NO_SANDBOX=true` to keep PDF generation
 * working until the container is fixed.
 */
export function buildPuppeteerLaunchOptions(extra?: LaunchOptions): LaunchOptions {
  const allowNoSandbox = (process.env.PUPPETEER_ALLOW_NO_SANDBOX ?? "")
    .toLowerCase()
    .trim();
  const useNoSandbox =
    allowNoSandbox === "1" ||
    allowNoSandbox === "true" ||
    allowNoSandbox === "yes";

  const baseArgs = useNoSandbox ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];
  const userArgs = extra?.args ?? [];

  return {
    headless: true,
    ...extra,
    args: [...baseArgs, ...userArgs],
  };
}
