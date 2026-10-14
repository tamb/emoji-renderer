import { IncompatibleOptionsError } from "./errors.ts";

/**
 * Pixel-art resampling. v2 keeps this object and removes `pixelate?: number`.
 *
 * `pixelate` and `pixelation` are different types. The number is not merged
 * into this object. `coercePixelation` is the only v1 bridge, and it goes away
 * in v2.
 */

export type PixelationRounding = "floor" | "round";
export type PixelationSmoothingQuality = "low" | "medium" | "high";

export interface PixelationScaleOptions {
  /** `imageSmoothingEnabled` for this draw. */
  smoothing?: boolean;
  /**
   * `imageSmoothingQuality` for this draw.
   * Applies when `smoothing` is true. Default `"low"` (bilinear).
   * Canvas ignores `quality` while `smoothing` is false. It is still stored
   * so a preset can turn smoothing on later without losing quality.
   */
  quality?: PixelationSmoothingQuality;
  /**
   * Fill this canvas before the draw.
   * `null` keeps it transparent.
   * Omit to use the top-level `background` option.
   * Omit versus explicit `null` stays in v2. It is not the legacy `pixelate` coercion.
   */
  background?: string | null;
}

export interface PixelationDownscaleOptions extends PixelationScaleOptions {
  /**
   * Cell count is `max(1, rounding(size / blockSize))`.
   * Default `"floor"`.
   */
  rounding?: PixelationRounding;
}

export interface PixelationOptions {
  /**
   * Target block size in output pixels. Must be a finite number `>= 2`.
   * v2 does not coerce strings or other types into this field.
   */
  blockSize: number;
  downscale?: PixelationDownscaleOptions;
  upscale?: PixelationScaleOptions;
}

/** Current `pixelate` filter: bilinear shrink, nearest enlarge, `floor`. */
export const smoothPixelation = {
  blockSize: 8,
  downscale: { smoothing: true, quality: "low", rounding: "floor" },
  upscale: { smoothing: false, quality: "low" },
} as const satisfies PixelationOptions;

/** Nearest-neighbor on both draws, with `round`. */
export const nearestPixelation = {
  blockSize: 8,
  downscale: { smoothing: false, quality: "low", rounding: "round" },
  upscale: { smoothing: false, quality: "low" },
} as const satisfies PixelationOptions;

export const pixelationPresets = {
  smooth: smoothPixelation,
  nearest: nearestPixelation,
} as const;

/**
 * Shown once per process when `pixelate >= 2`.
 * v2 removes `pixelate: number` and the coercion described on `coercePixelation`.
 */
export const PIXELATE_DEPRECATION_WARNING =
  "pixelate is deprecated and will be removed in a future major version. Use pixelation: { blockSize: N } or smoothPixelation instead.";

let pixelateDeprecationWarned = false;

export function resetPixelateDeprecationForTests(): void {
  pixelateDeprecationWarned = false;
}

function warnPixelateDeprecated(): void {
  if (pixelateDeprecationWarned) {
    return;
  }
  pixelateDeprecationWarned = true;
  console.warn(PIXELATE_DEPRECATION_WARNING);
}

function assertBlockSize(blockSize: number): void {
  if (!Number.isFinite(blockSize) || blockSize < 2) {
    throw new IncompatibleOptionsError("pixelation.blockSize must be a finite number >= 2");
  }
}

/**
 * v1 compatibility shim. Removed in v2 together with `pixelate?: number`.
 *
 * `pixelate` is a `number`. `pixelation` is a `PixelationOptions` object.
 * Those types are not merged.
 *
 * - Neither option, or `pixelate` below 2 with no `pixelation`: return `null`
 *   (full resolution, no warning). `0` and `1` stay silent no-ops.
 * - `pixelate >= 2` and no `pixelation`: warn once, then coerce to
 *   `{ blockSize: pixelate }`. Omitted stages later resolve to smooth defaults
 *   (downscale smoothing on, quality `"low"`, rounding `"floor"`; upscale
 *   smoothing off, quality `"low"`). That matches today's `pixelate` pixels.
 *   The `>=` comparison uses JavaScript ToNumber, so a numeric string counts
 *   as on. v2 removes that comparison and this number-to-object coercion.
 * - `pixelation` set: return that object as given. Do not copy `pixelate` into
 *   `blockSize` or either stage. If `pixelate >= 2` as well, still warn.
 * - `pixelation.blockSize` must already be a finite number `>= 2`. Strings and
 *   other non-numbers are not coerced; they throw `IncompatibleOptionsError`.
 *   That strict check does not apply to the legacy number (`pixelate: 0` and
 *   `pixelate: 1` stay silent no-ops).
 */
export function coercePixelation(options: {
  pixelate?: number;
  pixelation?: PixelationOptions;
}): PixelationOptions | null {
  const { pixelate, pixelation } = options;

  if (pixelate !== undefined && pixelate >= 2) {
    warnPixelateDeprecated();
  }

  if (pixelation !== undefined) {
    assertBlockSize(pixelation.blockSize);
    return pixelation;
  }

  if (pixelate !== undefined && pixelate >= 2) {
    return { blockSize: pixelate };
  }

  return null;
}

export interface ResolvedPixelationStage {
  smoothing: boolean;
  quality: PixelationSmoothingQuality;
  /** `null` means leave the canvas transparent. */
  background: string | null;
}

export interface ResolvedPixelation {
  blockSize: number;
  downscale: ResolvedPixelationStage & { rounding: PixelationRounding };
  upscale: ResolvedPixelationStage;
}

/**
 * Turn a coerced object into concrete stage settings.
 * Returns `null` when coercion returned `null`.
 *
 * Omitted stage fields use smooth defaults: downscale `smoothing: true`,
 * `quality: "low"`, `rounding: "floor"`; upscale `smoothing: false`,
 * `quality: "low"`. `{ blockSize: 8 }` therefore matches `pixelate: 8` on an
 * even split. An omitted stage `background` (`undefined`) uses
 * `fallbackBackground`. Explicit `null` stays transparent even when the
 * top-level background is set. That omit-versus-null rule stays in v2.
 */
export function resolvePixelation(
  pixelation: PixelationOptions | null | undefined,
  fallbackBackground: string | null,
): ResolvedPixelation | null {
  if (pixelation == null) {
    return null;
  }

  const downscale = pixelation.downscale;
  const upscale = pixelation.upscale;

  return {
    blockSize: pixelation.blockSize,
    downscale: {
      smoothing: downscale?.smoothing ?? true,
      quality: downscale?.quality ?? "low",
      rounding: downscale?.rounding ?? "floor",
      background: downscale?.background === undefined ? fallbackBackground : downscale.background,
    },
    upscale: {
      smoothing: upscale?.smoothing ?? false,
      quality: upscale?.quality ?? "low",
      background: upscale?.background === undefined ? fallbackBackground : upscale.background,
    },
  };
}
