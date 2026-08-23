import { expect, test, describe } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exportEntry(
  exports:
    | Record<string, { import?: string; types?: string; require?: string } | string>
    | undefined,
  key: string,
): { import?: string; types?: string; require?: string } {
  const entry = exports?.[key];
  expect(entry).toBeTruthy();
  if (typeof entry === "string") {
    return { import: entry };
  }
  return entry ?? {};
}

describe("package publish contract", () => {
  test("package.json exports tree-shakable ESM entry points", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      name: string;
      version: string;
      type?: string;
      sideEffects?: boolean;
      files?: string[];
      engines?: { node?: string };
      exports?: Record<string, { import?: string; types?: string; require?: string } | string>;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };

    expect(pkg.name).toBe("emoji-renderer");
    expect(pkg.version).toBe("1.0.0");
    expect(pkg.type).toBe("module");
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.files).toContain("dist");
    expect(pkg.engines?.node).toBe(">=22");
    expect(pkg.dependencies?.["@twemoji/api"]).toBeTruthy();
    expect(pkg.peerDependencies?.["@napi-rs/canvas"]).toBeTruthy();
    expect(pkg.peerDependencies?.["@resvg/resvg-js"]).toBeTruthy();
    expect(pkg.peerDependenciesMeta?.["@napi-rs/canvas"]?.optional).toBe(true);
    expect(pkg.peerDependenciesMeta?.["@resvg/resvg-js"]?.optional).toBe(true);

    expect(exportEntry(pkg.exports, ".").import).toBe("./dist/index.mjs");
    expect(exportEntry(pkg.exports, "./emojiToSvg").import).toBe("./dist/emojiToSvg.mjs");
    expect(exportEntry(pkg.exports, "./emojiToImage").import).toBe("./dist/emojiToImage.mjs");
    expect(exportEntry(pkg.exports, "./emojiToSvg").types).toBe("./dist/emojiToSvg.d.mts");
    expect(exportEntry(pkg.exports, "./emojiToImage").types).toBe("./dist/emojiToImage.d.mts");
    expect(exportEntry(pkg.exports, ".").require).toBeUndefined();
    expect(exportEntry(pkg.exports, "./emojiToSvg").require).toBeUndefined();
    expect(exportEntry(pkg.exports, "./emojiToImage").require).toBeUndefined();
  });
});
