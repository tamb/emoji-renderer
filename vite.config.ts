import { devices } from "playwright";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { VITEST_DESKTOP_BROWSERS, VITEST_MOBILE_DEVICES } from "./vitest.browsers.ts";

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

const NODE_CANVAS_SOURCE_SPECIFIERS = ['"./canvasEnv.node.ts"', "'./canvasEnv.node.ts'"] as const;

function publishNodeCanvasAdapter() {
  return {
    name: "publish-node-canvas-adapter",
    generateBundle(
      _options: unknown,
      bundle: Record<
        string,
        { type: string; code?: string; facadeModuleId?: string | null; fileName?: string }
      >,
    ) {
      const chunks = Object.values(bundle).filter(
        (
          item,
        ): item is {
          type: "chunk";
          code: string;
          facadeModuleId: string | null;
          fileName: string;
        } =>
          item.type === "chunk" &&
          typeof item.code === "string" &&
          typeof item.fileName === "string",
      );
      const nodeChunk = chunks.find(
        (item) =>
          item.fileName.endsWith(".mjs") && item.facadeModuleId?.endsWith("canvasEnv.node.ts"),
      );
      if (!nodeChunk) {
        return;
      }

      const publishedSpecifier = `"./${nodeChunk.fileName}"`;
      let rewrote = false;
      for (const item of chunks) {
        if (!item.fileName.endsWith(".mjs") || item === nodeChunk) {
          continue;
        }
        for (const specifier of NODE_CANVAS_SOURCE_SPECIFIERS) {
          if (!item.code.includes(specifier)) {
            continue;
          }
          item.code = item.code.replaceAll(specifier, publishedSpecifier);
          rewrote = true;
        }
      }

      const alreadyPublished = chunks.some(
        (item) => item.fileName.endsWith(".mjs") && item.code.includes(publishedSpecifier),
      );
      if (!rewrote && !alreadyPublished) {
        throw new Error(
          "Expected a published chunk to dynamically import ./canvasEnv.node.ts so it can be rewritten to the emitted adapter",
        );
      }
    },
  };
}

export default defineConfig({
  // Native canvas peers ship platform .node binaries; exclude them from client-side
  // dependency optimization so browser Vitest does not try to parse them as JS.
  optimizeDeps: {
    exclude: ["@napi-rs/canvas", "@resvg/resvg-js"],
  },
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    entry: ["src/index.ts", "src/emojiToSvg.ts", "src/emojiToImage.ts", "src/canvasEnv.node.ts"],
    plugins: [publishNodeCanvasAdapter()],
    dts: {
      generator: "tsgo",
    },
    exports: false,
    deps: {
      neverBundle: [/^@twemoji\/api$/, /^@napi-rs\/canvas$/, /^@resvg\/resvg-js$/],
    },
  },
  test: {
    // Node and browser projects must not share a Vite server. A shared server
    // would scan the Node canvas adapter and its .node binaries.
    sharedViteServer: false,
    deps: {
      optimizer: {
        client: {
          // Same exclusion for the browser Vitest project's dep optimizer.
          exclude: ["@napi-rs/canvas", "@resvg/resvg-js"],
        },
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/types.ts",
        "src/index.ts",
        "src/canvasEnv.node.ts",
        "src/generated/**",
        "src/**/*.test.ts",
        "src/**/*.stories.ts",
      ],
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
            instances: VITEST_DESKTOP_BROWSERS.map((browser) => ({ browser })),
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
            instances: VITEST_MOBILE_DEVICES.map(({ name, device }) =>
              mobileBrowserInstance(name, device),
            ),
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
