import { RasterizeError } from "./errors.ts";

export const NODE_CANVAS_INSTALL_HINT =
  'Install optional peers "@napi-rs/canvas" and "@resvg/resvg-js" to rasterize emoji images in Node.js';

type NodeCanvasModule = typeof import("@napi-rs/canvas");
type NodeCanvas = ReturnType<NodeCanvasModule["createCanvas"]>;
type NodeImage = Awaited<ReturnType<NodeCanvasModule["loadImage"]>>;
type NodeContext2D = ReturnType<NodeCanvas["getContext"]>;

export type CanvasLike = HTMLCanvasElement | OffscreenCanvas | NodeCanvas;
export type ImageLike = HTMLImageElement | NodeImage;
export type CanvasContext2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | NonNullable<NodeContext2D>;

let nodeCanvasModule: NodeCanvasModule | null | undefined;
let resvgModule: typeof import("@resvg/resvg-js") | null | undefined;
let nodeCanvasLoaderOverride: (() => Promise<NodeCanvasModule>) | undefined;

export function resetNodeCanvasModuleForTests(): void {
  nodeCanvasModule = undefined;
  resvgModule = undefined;
  nodeCanvasLoaderOverride = undefined;
}

export function setNodeCanvasLoaderForTests(
  loader: (() => Promise<NodeCanvasModule>) | undefined,
): void {
  nodeCanvasModule = undefined;
  nodeCanvasLoaderOverride = loader;
}

function isBrowserEnvironment(): boolean {
  return typeof document !== "undefined" || typeof OffscreenCanvas !== "undefined";
}

async function loadResvg(): Promise<typeof import("@resvg/resvg-js")> {
  if (resvgModule !== undefined) {
    if (resvgModule === null) {
      throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
    }
    return resvgModule;
  }

  try {
    resvgModule = await import("@resvg/resvg-js");
    return resvgModule;
  } catch {
    resvgModule = null;
    throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
  }
}

function decodeSvgDataUrl(url: string): string | null {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  if (!url.startsWith(prefix)) {
    return null;
  }

  return decodeURIComponent(url.slice(prefix.length));
}

async function loadSvgMarkupInNode(svg: string): Promise<NodeImage> {
  const [{ Resvg }, { loadImage }] = await Promise.all([loadResvg(), loadNodeCanvas()]);
  const png = new Resvg(svg).render().asPng();
  return loadImage(png);
}

async function loadNodeCanvas(): Promise<NodeCanvasModule> {
  if (nodeCanvasModule !== undefined) {
    if (nodeCanvasModule === null) {
      throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
    }
    return nodeCanvasModule;
  }

  if (nodeCanvasLoaderOverride) {
    try {
      nodeCanvasModule = await nodeCanvasLoaderOverride();
      return nodeCanvasModule;
    } catch {
      nodeCanvasModule = null;
      throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
    }
  }

  try {
    nodeCanvasModule = await import("@napi-rs/canvas");
    return nodeCanvasModule;
  } catch {
    nodeCanvasModule = null;
    throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
  }
}

export async function createCanvas(size: number): Promise<CanvasLike> {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(size, size);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }

  const { createCanvas: createNodeCanvas } = await loadNodeCanvas();
  return createNodeCanvas(size, size) as unknown as CanvasLike;
}

export function get2dContext(canvas: CanvasLike): CanvasContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new RasterizeError("Unable to acquire a 2D canvas context");
  }
  return context as CanvasContext2D;
}

export async function loadImageFromUrl(url: string): Promise<ImageLike> {
  if (typeof Image !== "undefined") {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new RasterizeError("Failed to load SVG image"));
      image.src = url;
    });
  }

  const { loadImage } = await loadNodeCanvas();
  const svgMarkup = decodeSvgDataUrl(url);
  if (svgMarkup !== null) {
    return loadSvgMarkupInNode(svgMarkup);
  }

  return loadImage(url);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
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

  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function canvasToBlob(
  canvas: CanvasLike,
  mimeType: "image/png" | "image/webp",
): Promise<Blob> {
  if ("convertToBlob" in canvas && typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: mimeType });
  }

  if ("toBuffer" in canvas && typeof canvas.toBuffer === "function") {
    const buffer = canvas.toBuffer(mimeType);
    return new Blob([new Uint8Array(buffer)], { type: mimeType });
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

export function isNodeCanvasRequired(): boolean {
  return !isBrowserEnvironment();
}
