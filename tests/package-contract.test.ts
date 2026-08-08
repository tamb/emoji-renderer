import { expect, test, describe } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exportEntry(
  exports: Record<string, { import?: string; types?: string } | string> | undefined,
  key: string,
): { import?: string; types?: string } {
  const entry = exports?.[key];
  expect(entry).toBeTruthy();
  if (typeof entry === "string") {
    return { import: entry };
  }
  return entry ?? {};
}

describe("package publish contract", () => {
  test("package.json exports tree-shakable entry points", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      name: string;
      sideEffects?: boolean;
      files?: string[];
      exports?: Record<string, { import?: string; types?: string } | string>;
      dependencies?: Record<string, string>;
    };

    expect(pkg.name).toBe("emoji-renderer");
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.files).toContain("dist");
    expect(pkg.dependencies?.["@twemoji/api"]).toBeTruthy();
    expect(exportEntry(pkg.exports, ".").import).toBe("./dist/index.mjs");
    expect(exportEntry(pkg.exports, "./emojiToSvg").import).toBe("./dist/emojiToSvg.mjs");
    expect(exportEntry(pkg.exports, "./emojiToImage").import).toBe("./dist/emojiToImage.mjs");
    expect(exportEntry(pkg.exports, "./emojiToSvg").types).toBe("./dist/emojiToSvg.d.mts");
    expect(exportEntry(pkg.exports, "./emojiToImage").types).toBe("./dist/emojiToImage.d.mts");
  });
});
