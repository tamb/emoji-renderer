import { IncompatibleOptionsError, RasterizeError } from "./errors.ts";

/**
 * Pull a rendered emoji toward grayscale.
 *
 * - `true` removes all color.
 * - A finite number from 0 to 1 is the fraction of the original saturation to
 *   remove. `0.2` removes 20% of that saturation, so 80% remains. `1` matches
 *   `true`. `0` leaves the colors unchanged.
 * - `false` and omitting the option leave the colors unchanged.
 *
 * Numeric strings are not coerced.
 */
export type Desaturate = boolean | number;

/**
 * Luma weights for SVG `feColorMatrix type="saturate"` and CSS `saturate()`.
 * Raster pixels use the same mix so a vector filter and a bitmap agree.
 */
const LUMA_R = 0.213;
const LUMA_G = 0.715;
const LUMA_B = 0.072;

const FILTER_ID = "emoji-renderer-desaturate";

export const DESATURATE_RANGE_MESSAGE = "desaturate must be true or a finite number from 0 to 1";

export const SATURATION_RANGE_MESSAGE = "saturation must be a finite number >= 0";

export const COLOR_SCALE_CONFLICT_MESSAGE = "desaturate and saturation cannot be used together";

function quantizeUnit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Fraction of original saturation to remove, or `null` when the emoji stays
 * in full color.
 *
 * `true` is `1`. `false`, omitted, and `0` are off. Any other value throws
 * `IncompatibleOptionsError`. Amounts are quantized to 6 decimal places so the
 * SVG `saturate` attribute and the canvas mix use the same number.
 */
export function resolveDesaturate(desaturate: unknown): number | null {
  if (desaturate === undefined || desaturate === false || desaturate === 0) {
    return null;
  }

  if (desaturate === true) {
    return 1;
  }

  if (
    typeof desaturate !== "number" ||
    !Number.isFinite(desaturate) ||
    desaturate < 0 ||
    desaturate > 1
  ) {
    throw new IncompatibleOptionsError(DESATURATE_RANGE_MESSAGE);
  }

  const amount = quantizeUnit(desaturate);
  return amount === 0 ? null : amount;
}

/**
 * Saturation multiplier, or `null` when the option is omitted.
 *
 * `1` is full color. `0` is grayscale. Values above `1` increase saturation.
 * The returned number is quantized to 6 decimal places. `1` is kept so it can
 * still conflict with an active `desaturate`.
 */
export function resolveSaturation(saturation: unknown): number | null {
  if (saturation === undefined) {
    return null;
  }

  if (typeof saturation !== "number" || !Number.isFinite(saturation) || saturation < 0) {
    throw new IncompatibleOptionsError(SATURATION_RANGE_MESSAGE);
  }

  return quantizeUnit(saturation);
}

/**
 * Saturation multiplier to apply, or `null` when the emoji stays in full color.
 *
 * `desaturate: 0.2` becomes `0.8`. `saturation: 0.2` stays `0.2`. `saturation: 1`
 * is a no-op. Setting both an active `desaturate` and any `saturation` throws.
 */
export function resolveColorScale(options: {
  desaturate?: unknown;
  saturation?: unknown;
}): number | null {
  const removal = resolveDesaturate(options.desaturate);
  const scale = resolveSaturation(options.saturation);

  if (removal !== null && scale !== null) {
    throw new IncompatibleOptionsError(COLOR_SCALE_CONFLICT_MESSAGE);
  }

  if (scale !== null) {
    return scale === 1 ? null : scale;
  }

  if (removal !== null) {
    return quantizeUnit(1 - removal);
  }

  return null;
}

/** Remaining saturation for `feColorMatrix type="saturate"`. `1` is unchanged, `0` is gray. */
export function formatRemainingSaturation(amount: number): string {
  return String(quantizeUnit(1 - amount));
}

function formatUnit(value: number): string {
  return String(quantizeUnit(value));
}

/** `feColorMatrix` body. `multiplier` is remaining saturation. Values above 1 use the full matrix. */
export function saturationFilter(multiplier: number): string {
  if (multiplier <= 1) {
    return `<feColorMatrix type="saturate" values="${formatUnit(multiplier)}"/>`;
  }

  const values = [
    LUMA_R + (1 - LUMA_R) * multiplier,
    LUMA_G - LUMA_G * multiplier,
    LUMA_B - LUMA_B * multiplier,
    0,
    0,
    LUMA_R - LUMA_R * multiplier,
    LUMA_G + (1 - LUMA_G) * multiplier,
    LUMA_B - LUMA_B * multiplier,
    0,
    0,
    LUMA_R - LUMA_R * multiplier,
    LUMA_G - LUMA_G * multiplier,
    LUMA_B + (1 - LUMA_B) * multiplier,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];

  return `<feColorMatrix type="matrix" values="${values.map((value) => formatUnit(value)).join(" ")}"/>`;
}

/**
 * Multiply each pixel's distance from luma. `multiplier` is the fraction of
 * the original saturation to keep: `0` is gray, `1` is unchanged, and values
 * above `1` boost color. Alpha is left unchanged.
 */
export function saturatePixels(data: Uint8ClampedArray, multiplier: number): void {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]!;
    const green = data[index + 1]!;
    const blue = data[index + 2]!;
    const luma = LUMA_R * red + LUMA_G * green + LUMA_B * blue;
    data[index] = luma + (red - luma) * multiplier;
    data[index + 1] = luma + (green - luma) * multiplier;
    data[index + 2] = luma + (blue - luma) * multiplier;
  }
}

/**
 * Mix each pixel toward its saturate-matrix luma. `amount` is the fraction of
 * saturation to remove. Alpha is left unchanged.
 */
export function desaturatePixels(data: Uint8ClampedArray, amount: number): void {
  saturatePixels(data, 1 - amount);
}

export function saturateCanvas(context: unknown, size: number, multiplier: number): void {
  const drawable = context as Partial<CanvasRenderingContext2D>;
  if (typeof drawable.getImageData !== "function" || typeof drawable.putImageData !== "function") {
    throw new RasterizeError("2D canvas context cannot read pixels to adjust saturation");
  }

  const imageData = drawable.getImageData(0, 0, size, size);
  saturatePixels(imageData.data, multiplier);
  drawable.putImageData(imageData, 0, 0);
}

export function desaturateCanvas(context: unknown, size: number, amount: number): void {
  saturateCanvas(context, size, 1 - amount);
}

/**
 * Keep the vector artwork and wrap it in an sRGB saturation filter.
 * `multiplier` is the fraction of the original saturation to keep.
 * Values above 1 use a color matrix so the boost is not clamped to grayscale.
 */
export function saturateSvg(svg: string, multiplier: number): string {
  const open = /<svg\b[^>]*>/i.exec(svg);
  const closeAt = svg.lastIndexOf("</svg>");
  if (open === null || closeAt < open.index + open[0].length) {
    throw new RasterizeError("SVG markup has no root element to adjust saturation");
  }

  const openEnd = open.index + open[0].length;
  const filter = `<defs><filter id="${FILTER_ID}" color-interpolation-filters="sRGB">${saturationFilter(multiplier)}</filter></defs><g filter="url(#${FILTER_ID})">`;

  return `${svg.slice(0, openEnd)}${filter}${svg.slice(openEnd, closeAt)}</g>${svg.slice(closeAt)}`;
}

/** `amount` is the fraction of saturation to remove. */
export function desaturateSvg(svg: string, amount: number): string {
  return saturateSvg(svg, quantizeUnit(1 - amount));
}
