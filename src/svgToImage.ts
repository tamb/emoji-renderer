import {
  blobToDataUrl,
  canvasToBlob,
  createCanvas,
  get2dContext,
  loadImageFromUrl,
} from "./canvasEnv.ts";
import { IncompatibleOptionsError, RasterizeError } from "./errors.ts";
import { coercePixelation, resolvePixelation } from "./pixelation.ts";
import type { PixelationOptions, PixelationRounding } from "./pixelation.ts";

export {
  blobToDataUrl,
  canvasToBlob,
  createCanvas,
  get2dContext,
  loadImageFromUrl,
} from "./canvasEnv.ts";

export interface SvgToImageOptions {
  svg: string;
  size?: number;
  mimeType?: "image/png" | "image/webp";
  background?: string | null;
  /**
   * @deprecated Removed in v2. Use `pixelation`.
   *
   * `pixelate` is a `number`. `pixelation` is a `PixelationOptions` object.
   * Those are different types and are not merged: when both are set, the object
   * is used as given and this number is not copied into `blockSize` or either stage.
   *
   * Until v2, values `>= 2` are coerced to `{ blockSize: pixelate }` with smooth
   * defaults (bilinear downscale, nearest upscale, `rounding: "floor"`).
   * Values below 2 mean off, do not warn, and are not coerced. The `>=` check
   * uses JavaScript ToNumber, so a numeric string counts as on. v2 removes
   * this option, that coercion, and that ToNumber check.
   */
  pixelate?: number;
  /**
   * Downscale and upscale settings. Wins over `pixelate` when both are set.
   * `blockSize` must be a finite number `>= 2` (not coerced from a string).
   */
  pixelation?: PixelationOptions;
}

interface DrawableContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: CanvasImageSource, ...args: number[]): void;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
}

function asDrawableContext(context: unknown): DrawableContext {
  return context as DrawableContext;
}

function svgMarkupToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function pixelationCellCount(
  size: number,
  blockSize: number,
  rounding: PixelationRounding,
): number {
  const scaled = size / blockSize;
  const cells = rounding === "round" ? Math.round(scaled) : Math.floor(scaled);
  return Math.max(1, cells);
}

export async function drawImageToContext(
  context: unknown,
  image: CanvasImageSource,
  size: number,
  background: string | null,
  pixelation?: PixelationOptions,
): Promise<void> {
  const ctx = asDrawableContext(context);
  const resolved = resolvePixelation(pixelation, background);
  if (resolved === null) {
    if (background !== null) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.drawImage(image, 0, 0, size, size);
    return;
  }

  const cells = pixelationCellCount(size, resolved.blockSize, resolved.downscale.rounding);
  const scratch = await createCanvas(cells);
  const scratchContext = asDrawableContext(get2dContext(scratch));

  if (resolved.downscale.background !== null) {
    scratchContext.fillStyle = resolved.downscale.background;
    scratchContext.fillRect(0, 0, cells, cells);
  }

  scratchContext.imageSmoothingEnabled = resolved.downscale.smoothing;
  scratchContext.imageSmoothingQuality = resolved.downscale.quality;
  scratchContext.drawImage(image, 0, 0, cells, cells);

  if (resolved.upscale.background !== null) {
    ctx.fillStyle = resolved.upscale.background;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.imageSmoothingEnabled = resolved.upscale.smoothing;
  ctx.imageSmoothingQuality = resolved.upscale.quality;
  ctx.drawImage(scratch as CanvasImageSource, 0, 0, cells, cells, 0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
}

export async function svgToImageBlob(options: SvgToImageOptions): Promise<Blob> {
  const {
    svg,
    size = 72,
    mimeType = "image/png",
    background = null,
    pixelate,
    pixelation: pixelationOption,
  } = options;
  // Coerce here so direct callers warn once. `emojiToImage` coerces first and
  // forwards only `pixelation`, so a legacy number is not coerced a second time.
  const pixelation = coercePixelation({ pixelate, pixelation: pixelationOption }) ?? undefined;

  try {
    const image = (await loadImageFromUrl(svgMarkupToDataUrl(svg))) as CanvasImageSource;
    const canvas = await createCanvas(size);
    const context = get2dContext(canvas);

    await drawImageToContext(context, image, size, background, pixelation);
    return canvasToBlob(canvas, mimeType);
  } catch (error) {
    if (error instanceof RasterizeError || error instanceof IncompatibleOptionsError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new RasterizeError(message, { cause: error });
  }
}

export async function svgToDataUrl(options: SvgToImageOptions): Promise<string> {
  const blob = await svgToImageBlob(options);
  return blobToDataUrl(blob);
}

export async function svgToHtmlImage(options: SvgToImageOptions): Promise<HTMLImageElement> {
  if (typeof Image === "undefined") {
    throw new RasterizeError('format: "image" requires a browser DOM with HTMLImageElement');
  }

  const blob = await svgToImageBlob(options);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageFromUrl(objectUrl);
    image.width = options.size ?? 72;
    image.height = options.size ?? 72;
    return image as HTMLImageElement;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
