import type { Image } from "@napi-rs/canvas";
import { RasterizeError } from "./errors.ts";
import type { NodeCanvasLike, NodeImageLike } from "./canvasEnv.ts";

/**
 * Node-only canvas rasterization. Loaded dynamically from canvasEnv.ts so optional
 * native peers (@napi-rs/canvas, @resvg/resvg-js) never enter the browser module graph.
 *
 * @napi-rs/canvas draws pixels but cannot rasterize SVG data URLs; resvg converts SVG
 * markup to PNG before loadImage when the URL is an inline svg data URL.
 */

const NODE_CANVAS_INSTALL_HINT =
  'Install optional peers "@napi-rs/canvas" and "@resvg/resvg-js" to rasterize emoji images in Node.js';

type NodeCanvasModule = typeof import("@napi-rs/canvas");

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

async function loadResvg(): Promise<typeof import("@resvg/resvg-js")> {
  if (resvgModule !== undefined) {
    if (resvgModule === null) {
      throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
    }
    return resvgModule;
  }

  try {
    // Lazy optional peer — keeps the published bundle free of native .node bindings.
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
    // Lazy optional peer — keeps the published bundle free of native .node bindings.
    nodeCanvasModule = await import("@napi-rs/canvas");
    return nodeCanvasModule;
  } catch {
    nodeCanvasModule = null;
    throw new RasterizeError(NODE_CANVAS_INSTALL_HINT);
  }
}

async function loadSvgMarkupInNode(svg: string): Promise<Image> {
  const [{ Resvg }, { loadImage }] = await Promise.all([loadResvg(), loadNodeCanvas()]);
  const png = new Resvg(svg).render().asPng();
  return loadImage(png);
}

export async function createNodeCanvas(size: number): Promise<NodeCanvasLike> {
  const { createCanvas } = await loadNodeCanvas();
  return createCanvas(size, size) as unknown as NodeCanvasLike;
}

export async function loadNodeImageFromUrl(url: string): Promise<NodeImageLike> {
  const svgMarkup = decodeSvgDataUrl(url);
  if (svgMarkup !== null) {
    return loadSvgMarkupInNode(svgMarkup);
  }

  const { loadImage } = await loadNodeCanvas();
  return loadImage(url);
}

export async function nodeCanvasToBlob(
  canvas: NodeCanvasLike,
  mimeType: "image/png" | "image/webp",
): Promise<Blob> {
  const buffer = (
    canvas as unknown as { toBuffer(mime: "image/png" | "image/webp"): Uint8Array }
  ).toBuffer(mimeType);
  return new Blob([new Uint8Array(buffer)], { type: mimeType });
}
