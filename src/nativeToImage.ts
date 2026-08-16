import { InvalidEmojiError, RasterizeError } from "./errors.ts";
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
  pixelate?: number;
  fontFamily?: string;
}

function assertEmoji(emoji: string): void {
  if (typeof emoji !== "string" || emoji.trim().length === 0) {
    throw new InvalidEmojiError();
  }
}

function renderNativeEmojiCanvas(
  options: NativeToImageOptions,
): HTMLCanvasElement | OffscreenCanvas {
  const { emoji, size = 72, background = null, fontFamily = DEFAULT_EMOJI_FONT_FAMILY } = options;

  assertEmoji(emoji);

  const canvas = createCanvas(size);
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
  const { size = 72, mimeType = "image/png", background = null, pixelate } = options;

  try {
    const sourceCanvas = renderNativeEmojiCanvas({
      ...options,
      background: pixelate !== undefined && pixelate >= 2 ? null : background,
    });

    if (pixelate !== undefined && pixelate >= 2) {
      const outputCanvas = createCanvas(size);
      const outputContext = get2dContext(outputCanvas);
      drawImageToContext(
        outputContext,
        sourceCanvas as CanvasImageSource,
        size,
        background,
        pixelate,
      );
      return canvasToBlob(outputCanvas, mimeType);
    }

    return canvasToBlob(sourceCanvas, mimeType);
  } catch (error) {
    throw error instanceof RasterizeError || error instanceof InvalidEmojiError
      ? error
      : new RasterizeError(String(error));
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
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
