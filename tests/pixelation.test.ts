import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { IncompatibleOptionsError } from "../src/errors.ts";
import {
  PIXELATE_DEPRECATION_WARNING,
  coercePixelation,
  nearestPixelation,
  resetPixelateDeprecationForTests,
  resolvePixelation,
  smoothPixelation,
} from "../src/pixelation.ts";

describe("coercePixelation", () => {
  afterEach(() => {
    resetPixelateDeprecationForTests();
    vi.restoreAllMocks();
  });

  test("returns null when neither option is set", () => {
    expect(coercePixelation({})).toBeNull();
  });

  test("returns null for pixelate below 2 without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(coercePixelation({ pixelate: 0 })).toBeNull();
    expect(coercePixelation({ pixelate: 1 })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  test("coerces pixelate >= 2 to a block size and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(coercePixelation({ pixelate: 8 })).toEqual({ blockSize: 8 });
    expect(coercePixelation({ pixelate: 4 })).toEqual({ blockSize: 4 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(PIXELATE_DEPRECATION_WARNING);

    resetPixelateDeprecationForTests();
    expect(coercePixelation({ pixelate: 8 })).toEqual({ blockSize: 8 });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test("uses pixelation as given and does not merge pixelate", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pixelation = {
      blockSize: 8,
      downscale: { smoothing: false, rounding: "round" as const },
    };

    expect(coercePixelation({ pixelate: 4, pixelation })).toBe(pixelation);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(coercePixelation({ pixelation: smoothPixelation })).toBe(smoothPixelation);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("throws for a non-finite or too-small blockSize without coercing it", () => {
    for (const blockSize of [Number.NaN, Number.POSITIVE_INFINITY, 1, 0, 1.5]) {
      expect(() => coercePixelation({ pixelation: { blockSize } })).toThrow(
        IncompatibleOptionsError,
      );
      expect(() => coercePixelation({ pixelation: { blockSize } })).toThrow(
        "pixelation.blockSize must be a finite number >= 2",
      );
    }
  });
});

describe("resolvePixelation", () => {
  test("returns null when coercion returned null", () => {
    expect(resolvePixelation(null, "#fff")).toBeNull();
    expect(resolvePixelation(undefined, "#fff")).toBeNull();
  });

  test("fills omitted stages with smooth defaults and the fallback background", () => {
    expect(resolvePixelation({ blockSize: 8 }, "#fff")).toEqual({
      blockSize: 8,
      downscale: { smoothing: true, quality: "low", rounding: "floor", background: "#fff" },
      upscale: { smoothing: false, quality: "low", background: "#fff" },
    });
    expect(resolvePixelation({ blockSize: 8 }, null)?.downscale.background).toBeNull();
  });

  test("keeps explicit null backgrounds transparent and keeps preset stage values", () => {
    expect(
      resolvePixelation(
        {
          blockSize: 6,
          downscale: { background: null, smoothing: false, quality: "high", rounding: "round" },
          upscale: { background: "#abc", quality: "medium" },
        },
        "#fff",
      ),
    ).toEqual({
      blockSize: 6,
      downscale: { smoothing: false, quality: "high", rounding: "round", background: null },
      upscale: { smoothing: false, quality: "medium", background: "#abc" },
    });
    expect(resolvePixelation(nearestPixelation, null)?.downscale.rounding).toBe("round");
    expect(resolvePixelation(smoothPixelation, null)?.downscale.smoothing).toBe(true);
    expect(resolvePixelation(nearestPixelation, null)?.downscale.smoothing).toBe(false);
  });
});
