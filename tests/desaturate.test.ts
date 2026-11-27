import { describe, expect, test } from "vite-plus/test";
import {
  COLOR_SCALE_CONFLICT_MESSAGE,
  DESATURATE_RANGE_MESSAGE,
  SATURATION_RANGE_MESSAGE,
  desaturateCanvas,
  desaturatePixels,
  desaturateSvg,
  formatRemainingSaturation,
  resolveColorScale,
  resolveDesaturate,
  resolveSaturation,
  saturationFilter,
  saturatePixels,
} from "../src/desaturate.ts";
import { IncompatibleOptionsError, RasterizeError } from "../src/errors.ts";

describe("resolveDesaturate", () => {
  test("treats omitted, false, and zero as off", () => {
    expect(resolveDesaturate(undefined)).toBeNull();
    expect(resolveDesaturate(false)).toBeNull();
    expect(resolveDesaturate(0)).toBeNull();
    expect(resolveDesaturate(0.0000004)).toBeNull();
  });

  test("maps true and 1 to full desaturation", () => {
    expect(resolveDesaturate(true)).toBe(1);
    expect(resolveDesaturate(1)).toBe(1);
  });

  test("keeps a partial amount", () => {
    expect(resolveDesaturate(0.2)).toBe(0.2);
    expect(formatRemainingSaturation(0.2)).toBe("0.8");
    expect(formatRemainingSaturation(1)).toBe("0");
  });

  test("rejects values outside 0 to 1", () => {
    for (const value of [1.1, -0.1, Number.NaN, Number.POSITIVE_INFINITY, "0.2", null]) {
      expect(() => resolveDesaturate(value)).toThrow(IncompatibleOptionsError);
      expect(() => resolveDesaturate(value)).toThrow(DESATURATE_RANGE_MESSAGE);
    }
  });
});

describe("resolveSaturation", () => {
  test("omits nothing and keeps 0, 1, and values above 1", () => {
    expect(resolveSaturation(undefined)).toBeNull();
    expect(resolveSaturation(0)).toBe(0);
    expect(resolveSaturation(1)).toBe(1);
    expect(resolveSaturation(0.2)).toBe(0.2);
    expect(resolveSaturation(1.5)).toBe(1.5);
  });

  test("rejects negative and non-finite values", () => {
    for (const value of [-0.1, Number.NaN, Number.POSITIVE_INFINITY, "1", null, true]) {
      expect(() => resolveSaturation(value)).toThrow(SATURATION_RANGE_MESSAGE);
    }
  });
});

describe("resolveColorScale", () => {
  test("turns desaturate into the saturation that remains", () => {
    expect(resolveColorScale({})).toBeNull();
    expect(resolveColorScale({ desaturate: false, saturation: 1 })).toBeNull();
    expect(resolveColorScale({ desaturate: 0.2 })).toBe(0.8);
    expect(resolveColorScale({ desaturate: true })).toBe(0);
    expect(resolveColorScale({ saturation: 0.2 })).toBe(0.2);
    expect(resolveColorScale({ saturation: 1.5 })).toBe(1.5);
    expect(resolveColorScale({ saturation: 0 })).toBe(0);
  });

  test("rejects using both options", () => {
    expect(() => resolveColorScale({ desaturate: 0.2, saturation: 1 })).toThrow(
      COLOR_SCALE_CONFLICT_MESSAGE,
    );
    expect(() => resolveColorScale({ desaturate: true, saturation: 0 })).toThrow(
      IncompatibleOptionsError,
    );
  });
});

describe("desaturatePixels", () => {
  test("removes 20% of a pure red pixel and all of it when amount is 1", () => {
    const partial = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 128]);
    desaturatePixels(partial, 0.2);
    expect(Array.from(partial)).toEqual([215, 11, 11, 255, 0, 0, 0, 128]);

    const gray = new Uint8ClampedArray([255, 0, 0, 200]);
    desaturatePixels(gray, 1);
    expect(Array.from(gray)).toEqual([54, 54, 54, 200]);
  });

  test("saturation 0.2 keeps 20% and 1.5 boosts a muted yellow", () => {
    const kept = new Uint8ClampedArray([255, 0, 0, 255]);
    saturatePixels(kept, 0.2);
    expect(Array.from(kept)).toEqual([94, 43, 43, 255]);

    const boosted = new Uint8ClampedArray([255, 204, 77, 255]);
    saturatePixels(boosted, 1.5);
    expect(Array.from(boosted)).toEqual([255, 203, 13, 255]);
    expect(saturationFilter(1.5)).toBe(
      '<feColorMatrix type="matrix" values="1.3935 -0.3575 -0.036 0 0 -0.1065 1.1425 -0.036 0 0 -0.1065 -0.3575 1.464 0 0 0 0 0 1 0"/>',
    );
    expect(saturationFilter(0.2)).toBe('<feColorMatrix type="saturate" values="0.2"/>');
  });
});

describe("desaturateCanvas", () => {
  test("writes the desaturated pixels back to the context", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const imageData = { data, width: 1, height: 1 };
    const putImageData = (next: { data: Uint8ClampedArray }) => {
      expect(next).toBe(imageData);
    };
    const context = {
      getImageData: () => imageData,
      putImageData,
    };

    desaturateCanvas(context, 1, 1);

    expect(Array.from(data)).toEqual([54, 54, 54, 255]);
  });

  test("throws when the context cannot read pixels", () => {
    expect(() =>
      desaturateCanvas({ getImageData: () => ({ data: new Uint8ClampedArray() }) }, 1, 1),
    ).toThrow(RasterizeError);
    expect(() => desaturateCanvas({}, 1, 1)).toThrow(
      "2D canvas context cannot read pixels to adjust saturation",
    );
  });
});

describe("desaturateSvg", () => {
  test("wraps the root contents in a saturate filter", () => {
    const svg = desaturateSvg(
      `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="#FFCC4D"/></svg>`,
      0.2,
    );

    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain(
      '<filter id="emoji-renderer-desaturate" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0.8"/></filter>',
    );
    expect(svg).toContain(
      '<g filter="url(#emoji-renderer-desaturate)"><circle fill="#FFCC4D"/></g></svg>',
    );
  });

  test("throws when the markup has no svg root", () => {
    expect(() => desaturateSvg("<div></div>", 1)).toThrow(RasterizeError);
    expect(() => desaturateSvg("<svg>", 1)).toThrow(
      "SVG markup has no root element to adjust saturation",
    );
  });
});
