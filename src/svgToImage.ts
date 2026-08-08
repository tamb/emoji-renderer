import { RasterizeError } from "./errors.ts";

export interface SvgToImageOptions {
  svg: string;
  size?: number;
  mimeType?: "image/png" | "image/webp";
  background?: string | null;
  /** Block size in output pixels. Values >= 2 enable nearest-neighbor upscaling. */
  pixelate?: number;
}

export function createCanvas(size: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(size, size);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }

  throw new RasterizeError("Canvas is not available in this environment");
}

export function get2dContext(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new RasterizeError("Unable to acquire a 2D canvas context");
  }
  return context;
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new RasterizeError("Failed to load SVG image"));
    image.src = url;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new RasterizeError("Failed to read blob as data URL"));
    };
    reader.onerror = () => reject(new RasterizeError("Failed to read blob as data URL"));
    reader.readAsDataURL(blob);
  });
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType: "image/png" | "image/webp",
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: mimeType });
  }

  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob === null) {
        reject(new RasterizeError("Canvas toBlob returned null"));
        return;
      }
      resolve(blob);
    }, mimeType);
  });
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

export function drawImageToContext(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  size: number,
  background: string | null,
  pixelate?: number,
): void {
  const blockSize = pixelate ?? 1;
  if (blockSize < 2) {
    if (background !== null) {
      context.fillStyle = background;
      context.fillRect(0, 0, size, size);
    }
    context.drawImage(image, 0, 0, size, size);
    return;
  }

  const smallSize = Math.max(1, Math.floor(size / blockSize));
  const scratch = createCanvas(smallSize);
  const scratchContext = get2dContext(scratch);

  if (background !== null) {
    scratchContext.fillStyle = background;
    scratchContext.fillRect(0, 0, smallSize, smallSize);
  }

  scratchContext.drawImage(image, 0, 0, smallSize, smallSize);

  if (background !== null) {
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(scratch, 0, 0, smallSize, smallSize, 0, 0, size, size);
  context.imageSmoothingEnabled = true;
}

export async function svgToImageBlob(options: SvgToImageOptions): Promise<Blob> {
  const { svg, size = 72, mimeType = "image/png", background = null, pixelate } = options;

  try {
    const image = await loadImageFromUrl(svgMarkupToDataUrl(svg));
    const canvas = createCanvas(size);
    const context = get2dContext(canvas);

    drawImageToContext(context, image, size, background, pixelate);
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
  const blob = await svgToImageBlob(options);
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
