/**
 * Installs Playwright browsers required by Vitest (see vitest.browsers.ts).
 * Used by `npm run test:install-browsers` — same command runs in CI and locally.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VITEST_BROWSER_HEADLESS, vitestPlaywrightInstallBrowsers } from "../vitest.browsers.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const playwrightBin = path.join(root, "node_modules", ".bin", "playwright");

const args = ["install", "--with-deps"];
if (VITEST_BROWSER_HEADLESS) {
  // Headless Vitest uses chrome-headless-shell for chromium, not full Chrome.
  args.push("--only-shell");
}
args.push(...vitestPlaywrightInstallBrowsers());

execFileSync(playwrightBin, args, { stdio: "inherit" });
