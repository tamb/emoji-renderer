import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/html-vite";

function getAbsolutePath(value: string): string {
  return path.dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const root = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-docs")],
  framework: getAbsolutePath("@storybook/html-vite"),
  async viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(typeof config.resolve.alias === "object" && !Array.isArray(config.resolve.alias)
        ? config.resolve.alias
        : {}),
      "emoji-renderer": path.resolve(root, "../src/index.ts"),
    };

    // Set by the Deploy Storybook workflow for GitHub Pages project sites.
    if (process.env.STORYBOOK_BASE_PATH) {
      config.base = process.env.STORYBOOK_BASE_PATH;
    }

    return config;
  },
};

export default config;
