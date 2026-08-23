import {
  blobToDataUrl,
  canvasToBlob,
  createCanvas,
  get2dContext,
  loadImageFromUrl,
} from "./canvasEnv.ts";
import { RasterizeError } from "./errors.ts";

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
  /** Block size in output pixels. Values >= 2 enable nearest-neighbor upscaling. */
  pixelate?: number;
}

interface DrawableContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: CanvasImageSource, ...args: number[]): void;
  imageSmoothingEnabled: boolean;
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

export async function drawImageToContext(
  context: unknown,
  image: CanvasImageSource,
  size: number,
  background: string | null,
  pixelate?: number,
): Promise<void> {
  const ctx = asDrawableContext(context);
  const blockSize = pixelate ?? 1;
  if (blockSize < 2) {
    if (background !== null) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.drawImage(image, 0, 0, size, size);
    return;
  }

  const smallSize = Math.max(1, Math.floor(size / blockSize));
  const scratch = await createCanvas(smallSize);
  const scratchContext = asDrawableContext(get2dContext(scratch));

  if (background !== null) {
    scratchContext.fillStyle = background;
    scratchContext.fillRect(0, 0, smallSize, smallSize);
  }

  scratchContext.drawImage(image, 0, 0, smallSize, smallSize);

  if (background !== null) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch as CanvasImageSource, 0, 0, smallSize, smallSize, 0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
}

export async function svgToImageBlob(options: SvgToImageOptions): Promise<Blob> {
  const { svg, size = 72, mimeType = "image/png", background = null, pixelate } = options;

  try {
    const image = (await loadImageFromUrl(svgMarkupToDataUrl(svg))) as CanvasImageSource;
    const canvas = await createCanvas(size);
    const context = get2dContext(canvas);

    await drawImageToContext(context, image, size, background, pixelate);
    return canvasToBlob(canvas, mimeType);
  } catch (error) {
    throw error instanceof RasterizeError ? error : new RasterizeError(String(error));
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
