import { describe, expect, test, vi } from "vite-plus/test";
import {
  normalizeSrcSetWidths,
  resolveDefaultSrcWidth,
  resolveDevicePixelRatio,
  resolveRenderSize,
  resolveResponsiveImage,
  resolveResponsiveSvg,
} from "../src/responsive.ts";

describe("responsive helpers", () => {
  test("resolveResponsiveSvg returns intrinsic mode for boolean true", () => {
    expect(resolveResponsiveSvg(true)).toEqual({ mode: "intrinsic" });
  });

  test("resolveResponsiveImage returns fixed layout by default", () => {
    expect(resolveResponsiveImage(undefined, 48)).toEqual({ dpr: 1, display: "fixed" });
  });

  test("resolveResponsiveImage applies auto dpr when enabled", () => {
    vi.stubGlobal("devicePixelRatio", 2);

    expect(resolveResponsiveImage(true, 48)).toEqual({
      dpr: 2,
      display: "css",
      style: { width: "48px", height: "48px" },
    });

    vi.unstubAllGlobals();
  });

  test("normalizeSrcSetWidths dedupes and sorts widths", () => {
    expect(normalizeSrcSetWidths([96, 24, 48, 24], 72)).toEqual([24, 48, 96]);
  });

  test("resolveDefaultSrcWidth prefers size when present", () => {
    expect(resolveDefaultSrcWidth([24, 48, 96], 48)).toBe(48);
    expect(resolveDefaultSrcWidth([24, 48, 96], 72)).toBe(96);
  });

  test("resolveRenderSize rounds logical size by dpr", () => {
    expect(resolveRenderSize(48, 2)).toBe(96);
  });

  test("resolveDevicePixelRatio falls back to 1", () => {
    vi.stubGlobal("devicePixelRatio", 0);
    expect(resolveDevicePixelRatio()).toBe(1);
    vi.unstubAllGlobals();
  });
});
