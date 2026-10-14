import { IncompatibleOptionsError, InvalidEmojiError, RasterizeError } from "./errors.ts";
import { coercePixelation } from "./pixelation.ts";
import type { PixelationOptions } from "./pixelation.ts";
import {
  blobToDataUrl,
  canvasToBlob,
  createCanvas,
  drawImageToContext,
  get2dContext,
  loadImageFromUrl,
} from "./svgToImage.ts";

export const DEFAULT_EMOJI_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "EmojiOne Color", sans-serif';

export interface NativeToImageOptions {
  emoji: string;
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
   * this option, that coercion, and that ToNumber check. While the coercion
   * is active, the glyph canvas stays transparent and stage backgrounds are
   * applied later.
   */
  pixelate?: number;
  /**
   * Downscale and upscale settings. Wins over `pixelate` when both are set.
   * `blockSize` must be a finite number `>= 2` (not coerced from a string).
   * An active object also keeps the glyph canvas transparent.
   */
  pixelation?: PixelationOptions;
  fontFamily?: string;
}

function assertEmoji(emoji: string): void {
  if (typeof emoji !== "string" || emoji.trim().length === 0) {
    throw new InvalidEmojiError();
  }
}

async function renderNativeEmojiCanvas(options: NativeToImageOptions) {
  const { emoji, size = 72, background = null, fontFamily = DEFAULT_EMOJI_FONT_FAMILY } = options;

  assertEmoji(emoji);

  const canvas = await createCanvas(size);
  const context = get2dContext(canvas);

  if (background !== null) {
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
  }

  context.font = `${Math.round(size * 0.85)}px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji.trim(), size / 2, size / 2);

  return canvas;
}

export async function nativeEmojiToImageBlob(options: NativeToImageOptions): Promise<Blob> {
  const {
    size = 72,
    mimeType = "image/png",
    background = null,
    pixelate,
    pixelation: pixelationOption,
  } = options;
  // Coerce once. v2 removes `pixelate: number` and this number-to-object step.
  // An active result keeps the glyph canvas transparent so stage backgrounds
  // are the only fills. A null result still paints `background` on the text.
  const pixelation = coercePixelation({ pixelate, pixelation: pixelationOption });

  try {
    const sourceCanvas = await renderNativeEmojiCanvas({
      ...options,
      background: pixelation !== null ? null : background,
    });

    if (pixelation !== null) {
      const outputCanvas = await createCanvas(size);
      const outputContext = get2dContext(outputCanvas);
      await drawImageToContext(
        outputContext,
        sourceCanvas as CanvasImageSource,
        size,
        background,
        pixelation,
      );
      return canvasToBlob(outputCanvas, mimeType);
    }

    return canvasToBlob(sourceCanvas, mimeType);
  } catch (error) {
    if (
      error instanceof RasterizeError ||
      error instanceof InvalidEmojiError ||
      error instanceof IncompatibleOptionsError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new RasterizeError(message, { cause: error });
  }
}

export async function nativeEmojiToDataUrl(options: NativeToImageOptions): Promise<string> {
  const blob = await nativeEmojiToImageBlob(options);
  return blobToDataUrl(blob);
}

export async function nativeEmojiToHtmlImage(
  options: NativeToImageOptions,
): Promise<HTMLImageElement> {
  const blob = await nativeEmojiToImageBlob(options);
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
