import type { devices } from "playwright";

/** Desktop engines for the Vitest `browser` project. */
export const VITEST_DESKTOP_BROWSERS = ["chromium", "firefox", "webkit"] as const;

export type VitestDesktopBrowser = (typeof VITEST_DESKTOP_BROWSERS)[number];

/** Device presets for the Vitest `browser-mobile` project (reuse webkit + chromium). */
export const VITEST_MOBILE_DEVICES = [
  { name: "mobile-safari", device: "iPhone 15" },
  { name: "mobile-chrome", device: "Pixel 8" },
] as const satisfies ReadonlyArray<{
  name: string;
  device: keyof typeof devices;
}>;

/** All Vitest browser projects run headless (see vite.config.ts). */
export const VITEST_BROWSER_HEADLESS = true;

/** Playwright CLI browser names to install before `npm test`. */
export function vitestPlaywrightInstallBrowsers(): readonly VitestDesktopBrowser[] {
  return VITEST_DESKTOP_BROWSERS;
}
