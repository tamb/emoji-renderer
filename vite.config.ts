import { devices } from "playwright";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

function mobileBrowserInstance(name: string, deviceName: "iPhone 15" | "Pixel 8") {
  const device = devices[deviceName];
  const viewport = device.viewport ?? { width: 390, height: 844 };

  return {
    name,
    browser: device.defaultBrowserType,
    viewport,
    provider: playwright({
      contextOptions: {
        userAgent: device.userAgent,
        viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.hasTouch,
      },
    }),
  };
}

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    entry: ["src/index.ts", "src/emojiToSvg.ts", "src/emojiToImage.ts"],
    dts: {
      tsgo: true,
    },
    exports: false,
    deps: {
      neverBundle: [/^@twemoji\/api$/, /^@napi-rs\/canvas$/, /^@resvg\/resvg-js$/],
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/types.ts", "src/index.ts", "src/**/*.test.ts", "src/**/*.stories.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/node/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/node/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["e2e/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
          },
        },
      },
      {
        extends: true,
        test: {
          name: "browser-mobile",
          include: ["e2e/**/*.browser.test.ts", "e2e/**/*.mobile.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              mobileBrowserInstance("mobile-safari", "iPhone 15"),
              mobileBrowserInstance("mobile-chrome", "Pixel 8"),
            ],
          },
        },
      },
    ],
  },
  lint: {
    ignorePatterns: [
      "demo/**",
      "coverage/**",
      "dist/**",
      "storybook-static/**",
      ".storybook/**",
      "src/generated/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: [
      "demo/**",
      "coverage/**",
      "dist/**",
      "storybook-static/**",
      "src/generated/**",
    ],
  },
});
