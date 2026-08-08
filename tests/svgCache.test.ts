import { describe, expect, test } from "vite-plus/test";
import { SvgCache } from "../src/svgCache.ts";

describe("SvgCache", () => {
  test("stores and retrieves values", () => {
    const cache = new SvgCache();
    cache.set("a", "<svg>a</svg>");
    expect(cache.get("a")).toBe("<svg>a</svg>");
  });

  test("returns undefined for missing keys", () => {
    const cache = new SvgCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  test("refreshes key order on get for LRU behavior", () => {
    const cache = new SvgCache(2);
    cache.set("first", "1");
    cache.set("second", "2");
    expect(cache.get("first")).toBe("1");
    cache.set("third", "3");

    expect(cache.get("second")).toBeUndefined();
    expect(cache.get("first")).toBe("1");
    expect(cache.get("third")).toBe("3");
  });

  test("updates an existing key without growing size", () => {
    const cache = new SvgCache(2);
    cache.set("a", "v1");
    cache.set("b", "v2");
    cache.set("a", "v2");

    expect(cache.get("a")).toBe("v2");
    expect(cache.get("b")).toBe("v2");
  });

  test("clears all entries", () => {
    const cache = new SvgCache();
    cache.set("a", "1");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
