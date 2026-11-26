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

/** Remaining saturation for `feColorMatrix type="saturate"`. `1` is unchanged, `0` is gray. */
export function formatRemainingSaturation(amount: number): string {
  return String(quantizeUnit(1 - amount));
}

/**
 * Mix each pixel toward its saturate-matrix luma. `amount` is the fraction of
 * saturation to remove. Alpha is left unchanged.
 */
export function desaturatePixels(data: Uint8ClampedArray, amount: number): void {
  const keep = 1 - amount;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]!;
    const green = data[index + 1]!;
    const blue = data[index + 2]!;
    const luma = LUMA_R * red + LUMA_G * green + LUMA_B * blue;
    data[index] = luma + (red - luma) * keep;
    data[index + 1] = luma + (green - luma) * keep;
    data[index + 2] = luma + (blue - luma) * keep;
  }
}

export function desaturateCanvas(context: unknown, size: number, amount: number): void {
  const drawable = context as Partial<CanvasRenderingContext2D>;
  if (typeof drawable.getImageData !== "function" || typeof drawable.putImageData !== "function") {
    throw new RasterizeError("2D canvas context cannot read pixels for desaturate");
  }

  const imageData = drawable.getImageData(0, 0, size, size);
  desaturatePixels(imageData.data, amount);
  drawable.putImageData(imageData, 0, 0);
}

/**
 * Keep the vector artwork and wrap it in an sRGB saturate filter.
 * `amount` is the fraction of saturation to remove.
 */
export function desaturateSvg(svg: string, amount: number): string {
  const open = /<svg\b[^>]*>/i.exec(svg);
  const closeAt = svg.lastIndexOf("</svg>");
  if (open === null || closeAt < open.index + open[0].length) {
    throw new RasterizeError("SVG markup has no root element to desaturate");
  }

  const remaining = formatRemainingSaturation(amount);
  const openEnd = open.index + open[0].length;
  const filter = `<defs><filter id="${FILTER_ID}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${remaining}"/></filter></defs><g filter="url(#${FILTER_ID})">`;

  return `${svg.slice(0, openEnd)}${filter}${svg.slice(openEnd, closeAt)}</g>${svg.slice(closeAt)}`;
}
