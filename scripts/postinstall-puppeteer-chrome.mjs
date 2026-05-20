/**
 * Skip downloading Chrome on Vercel — production uses @sparticuz/chromium instead.
 * Local dev / Railway still need Puppeteer's Chrome unless PUPPETEER_EXECUTABLE_PATH is set.
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL) {
  console.log("postinstall: skipping Puppeteer Chrome on Vercel");
  process.exit(0);
}

execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
