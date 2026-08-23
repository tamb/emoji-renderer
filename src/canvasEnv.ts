import { RasterizeError } from "./errors.ts";

/**
 * Browser-safe canvas adapter. Node rasterization lives in canvasEnv.node.ts and
 * is loaded only at runtime when no DOM canvas is available (see loadNodeEnv).
 *
 * Keeping native peer imports out of this file prevents Vite/Vitest browser projects
 * from scanning @napi-rs/canvas / @resvg/resvg-js and choking on their .node binaries.
 */

export const NODE_CANVAS_INSTALL_HINT =
  'Install optional peers "@napi-rs/canvas" and "@resvg/resvg-js" to rasterize emoji images in Node.js';

// Structural types shared with canvasEnv.node.ts without importing that module
// (a static import would pull native deps back into the browser bundle graph).
export interface NodeCanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): unknown;
  convertToBlob?(options: { type: string }): Promise<Blob>;
  toBuffer?(mimeType: string): Uint8Array;
}

export interface NodeImageLike {
  width: number;
  height: number;
}

export interface MinimalCanvasContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: CanvasImageSource, ...args: number[]): void;
  imageSmoothingEnabled: boolean;
}

export type CanvasLike = HTMLCanvasElement | OffscreenCanvas | NodeCanvasLike;
export type ImageLike = HTMLImageElement | NodeImageLike;
export type CanvasContext2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | MinimalCanvasContext2D;

type NodeCanvasLoader = () => Promise<{
  createCanvas: (width: number, height: number) => NodeCanvasLike;
  loadImage: (source: string | Uint8Array) => Promise<NodeImageLike>;
}>;

interface NodeCanvasEnvModule {
  createNodeCanvas(size: number): Promise<NodeCanvasLike>;
  loadNodeImageFromUrl(url: string): Promise<NodeImageLike>;
  nodeCanvasToBlob(canvas: NodeCanvasLike, mimeType: "image/png" | "image/webp"): Promise<Blob>;
  setNodeCanvasLoaderForTests(loader: NodeCanvasLoader | undefined): void;
  resetNodeCanvasModuleForTests(): void;
}

let nodeEnv: NodeCanvasEnvModule | null | undefined;
// Queued before the first loadNodeEnv call so tests can inject a mock loader.
let pendingNodeCanvasLoader: NodeCanvasLoader | undefined;

async function loadNodeEnv(): Promise<NodeCanvasEnvModule> {
  if (nodeEnv !== undefined) {
    if (nodeEnv === null) {
      throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
    }
    return nodeEnv;
  }

  try {
    // Dynamic import + @vite-ignore: only resolved in Node, never pre-bundled for browser tests.
    const env = (await import(
      /* @vite-ignore */ "./canvasEnv.node.ts"
    )) as unknown as NodeCanvasEnvModule;
    if (pendingNodeCanvasLoader !== undefined) {
      env.setNodeCanvasLoaderForTests(pendingNodeCanvasLoader);
      pendingNodeCanvasLoader = undefined;
    }
    nodeEnv = env;
    return env;
  } catch {
    nodeEnv = null;
    throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
  }
}

export function resetNodeCanvasModuleForTests(): void {
  nodeEnv?.resetNodeCanvasModuleForTests();
  nodeEnv = undefined;
  pendingNodeCanvasLoader = undefined;
}

export function setNodeCanvasLoaderForTests(loader: NodeCanvasLoader | undefined): void {
  pendingNodeCanvasLoader = loader;
  nodeEnv = undefined;
}

function isBrowserEnvironment(): boolean {
  return typeof document !== "undefined" || typeof OffscreenCanvas !== "undefined";
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

  const nodeCanvasEnv = await loadNodeEnv();
  return nodeCanvasEnv.createNodeCanvas(size);
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

  const nodeCanvasEnv = await loadNodeEnv();
  return nodeCanvasEnv.loadNodeImageFromUrl(url);
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
    const nodeCanvasEnv = await loadNodeEnv();
    return nodeCanvasEnv.nodeCanvasToBlob(canvas, mimeType);
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
