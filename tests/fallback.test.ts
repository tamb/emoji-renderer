import { describe, expect, test } from "vite-plus/test";
import { EmojiNotFoundError, IncompatibleOptionsError, InvalidEmojiError } from "../src/errors.ts";
import { isAbortError, shouldTryNextSource, throwIfAborted } from "../src/fallback.ts";
import { assertCdnFallbacks, EMOJI_CDN_PRESETS } from "../src/sources.ts";

describe("fallback helpers", () => {
  test("lists the supported CDN presets", () => {
    expect(EMOJI_CDN_PRESETS).toEqual(["twemoji", "openmoji", "noto", "fluent"]);
  });

  test("assertCdnFallbacks rejects unknown sources", () => {
    expect(() => assertCdnFallbacks(["twemoji", "noto"])).not.toThrow();
    expect(() => assertCdnFallbacks(["native"])).toThrow(IncompatibleOptionsError);
  });

  test("shouldTryNextSource retries fetch misses and network errors", () => {
    expect(shouldTryNextSource(new EmojiNotFoundError("😀", "https://example.com"))).toBe(true);
    expect(shouldTryNextSource(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldTryNextSource(new Error("fetch is not available in this environment"))).toBe(true);
    expect(shouldTryNextSource(new InvalidEmojiError())).toBe(false);
    expect(shouldTryNextSource(new DOMException("The operation was aborted.", "AbortError"))).toBe(
      false,
    );
  });

  test("throwIfAborted raises AbortError when the signal is aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrowError();
    expect(isAbortError(new DOMException("The operation was aborted.", "AbortError"))).toBe(true);
  });
});
