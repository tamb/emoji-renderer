import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  NODE_CANVAS_INSTALL_HINT,
  resetNodeCanvasModuleForTests,
  setNodeCanvasLoaderForTests,
} from "../src/canvasEnv.ts";
import { IncompatibleOptionsError, RasterizeError } from "../src/errors.ts";
import {
  PIXELATE_DEPRECATION_WARNING,
  nearestPixelation,
  resetPixelateDeprecationForTests,
} from "../src/pixelation.ts";
import { svgToDataUrl, svgToHtmlImage, svgToImageBlob } from "../src/svgToImage.ts";
import { installTrackedCanvases, mockCanvas, SAMPLE_SVG } from "./helpers.ts";

describe("svgToImage", () => {
  let restoreOffscreenCanvas: (() => void) | undefined;

  afterEach(() => {
    restoreOffscreenCanvas?.();
    restoreOffscreenCanvas = undefined;
    vi.restoreAllMocks();
  });

  test("rasterizes SVG markup to a PNG blob", async () => {
    restoreOffscreenCanvas = mockCanvas();

    const blob = await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  test("pixelates output with nearest-neighbor scaling", async () => {
    resetPixelateDeprecationForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    restoreOffscreenCanvas = mockCanvas();
    const drawImage = vi.fn();
    const context = {
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage,
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      pixelate: 8,
    });

    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(PIXELATE_DEPRECATION_WARNING);

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      pixelate: 8,
    });
    expect(warn).toHaveBeenCalledTimes(1);

    resetPixelateDeprecationForTests();
    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      pixelate: 8,
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test("fills the canvas background when provided", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect,
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      background: "#ffffff",
    });

    expect(fillRect).toHaveBeenCalledWith(0, 0, 32, 32);
  });

  test("uses OffscreenCanvas.convertToBlob when available", async () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    const convertToBlob = vi.fn(async () => new Blob(["png"], { type: "image/png" }));
    class MockOffscreenCanvas {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        return {
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        };
      }

      convertToBlob = convertToBlob;
    }

    globalThis.OffscreenCanvas = MockOffscreenCanvas as unknown as typeof OffscreenCanvas;
    const ImageMock = function ImageMock(this: unknown) {
      const image = document.createElement("img");
      queueMicrotask(() => image.dispatchEvent(new Event("load")));
      return image;
    } as unknown as typeof Image;
    vi.spyOn(globalThis, "Image").mockImplementation(ImageMock);

    try {
      await svgToImageBlob({ svg: SAMPLE_SVG, size: 24 });
      expect(convertToBlob).toHaveBeenCalledWith({ type: "image/png" });
    } finally {
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
    }
  });

  test("returns a data URL from rasterized output", async () => {
    restoreOffscreenCanvas = mockCanvas();

    const dataUrl = await svgToDataUrl({
      svg: SAMPLE_SVG,
      size: 32,
    });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("returns an HTMLImageElement", async () => {
    restoreOffscreenCanvas = mockCanvas();

    const image = await svgToHtmlImage({
      svg: SAMPLE_SVG,
      size: 32,
    });

    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.width).toBe(32);
    expect(image.height).toBe(32);
  });

  test("throws RasterizeError when canvas context is unavailable", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(
      svgToImageBlob({
        svg: SAMPLE_SVG,
      }),
    ).rejects.toBeInstanceOf(RasterizeError);
  });

  test("throws RasterizeError when canvas toBlob returns null", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(null);
    });

    await expect(
      svgToImageBlob({
        svg: SAMPLE_SVG,
      }),
    ).rejects.toThrow("Canvas toBlob returned null");
  });

  test("throws RasterizeError when the SVG image fails to load", async () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    // @ts-expect-error test override
    delete globalThis.OffscreenCanvas;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });

    const ImageMock = function ImageMock(this: unknown) {
      const image = document.createElement("img");
      Object.defineProperty(image, "src", {
        set() {
          queueMicrotask(() => {
            image.onerror?.(new Event("error"));
          });
        },
      });
      return image;
    } as unknown as typeof Image;
    vi.spyOn(globalThis, "Image").mockImplementation(ImageMock);

    await expect(
      svgToImageBlob({
        svg: SAMPLE_SVG,
      }),
    ).rejects.toThrow("Failed to load SVG image");

    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  });

  test("surfaces Node canvas loader failures that are not a missing peer", async () => {
    resetNodeCanvasModuleForTests();
    setNodeCanvasLoaderForTests(async () => {
      throw new Error("canvas binary failed to load");
    });

    const originalDocument = globalThis.document;
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    // @ts-expect-error test override
    delete globalThis.document;
    // @ts-expect-error test override
    delete globalThis.OffscreenCanvas;

    try {
      await expect(
        svgToImageBlob({
          svg: SAMPLE_SVG,
        }),
      ).rejects.toThrow("canvas binary failed to load");
    } finally {
      globalThis.document = originalDocument;
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
      resetNodeCanvasModuleForTests();
    }
  });

  test("throws the install hint when the Node canvas peer cannot be resolved", async () => {
    resetNodeCanvasModuleForTests();
    setNodeCanvasLoaderForTests(async () => {
      const error = new Error("Cannot find package '@napi-rs/canvas'");
      Object.assign(error, { code: "ERR_MODULE_NOT_FOUND" });
      throw error;
    });

    const originalDocument = globalThis.document;
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    // @ts-expect-error test override
    delete globalThis.document;
    // @ts-expect-error test override
    delete globalThis.OffscreenCanvas;

    try {
      await expect(
        svgToImageBlob({
          svg: SAMPLE_SVG,
        }),
      ).rejects.toThrow(NODE_CANVAS_INSTALL_HINT);
    } finally {
      globalThis.document = originalDocument;
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
      resetNodeCanvasModuleForTests();
    }
  });

  test("throws RasterizeError when FileReader returns a non-string", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.spyOn(globalThis, "FileReader").mockImplementation(function MockFileReader(
      this: FileReader,
    ) {
      this.readAsDataURL = vi.fn(() => {
        queueMicrotask(() => {
          Object.defineProperty(this, "result", { value: null });
          this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
        });
      });
      return this;
    } as unknown as typeof FileReader);

    await expect(
      svgToDataUrl({
        svg: SAMPLE_SVG,
      }),
    ).rejects.toThrow("Failed to read blob as data URL");
  });

  test("pixelate below 2 does not warn or create a scratch canvas", async () => {
    resetPixelateDeprecationForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({ svg: SAMPLE_SVG, size: 32, pixelate: 0 });
    await svgToImageBlob({ svg: SAMPLE_SVG, size: 32, pixelate: 1 });

    expect(warn).not.toHaveBeenCalled();
    expect(tracked.canvases.map((canvas) => canvas.width)).toEqual([32, 32]);
    expect(tracked.canvases[0]?.context.imageSmoothingEnabled).toBe(false);
    expect(tracked.canvases[0]?.context.imageSmoothingQuality).toBe("high");
  });

  test("pixelate 8 uses a floor cell grid and restores output smoothing", async () => {
    resetPixelateDeprecationForTests();
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({ svg: SAMPLE_SVG, size: 32, pixelate: 8 });

    const output = tracked.canvases[0];
    const scratch = tracked.canvases[1];
    expect(output?.width).toBe(32);
    expect(scratch?.width).toBe(4);
    expect(scratch?.context.smoothingAtDraw).toEqual([true]);
    expect(scratch?.context.qualityAtDraw).toEqual(["low"]);
    expect(output?.context.smoothingAtDraw).toEqual([false]);
    expect(output?.context.qualityAtDraw).toEqual(["low"]);
    expect(output?.context.imageSmoothingEnabled).toBe(true);
    expect(output?.context.imageSmoothingQuality).toBe("low");
    expect(scratch?.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4, 4);
    expect(output?.context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      4,
      4,
      0,
      0,
      32,
      32,
    );
  });

  test("blockSize 8 matches pixelate 8 and does not warn", async () => {
    resetPixelateDeprecationForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({ svg: SAMPLE_SVG, size: 32, pixelation: { blockSize: 8 } });

    expect(warn).not.toHaveBeenCalled();
    expect(tracked.canvases[1]?.width).toBe(4);
    expect(tracked.canvases[1]?.context.smoothingAtDraw).toEqual([true]);
    expect(tracked.canvases[0]?.context.smoothingAtDraw).toEqual([false]);
    expect(tracked.canvases[0]?.context.imageSmoothingEnabled).toBe(true);
  });

  test("pixelation wins over pixelate and still warns", async () => {
    resetPixelateDeprecationForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      pixelate: 4,
      pixelation: { blockSize: 8 },
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(PIXELATE_DEPRECATION_WARNING);
    expect(tracked.canvases[1]?.width).toBe(4);
  });

  test("nearestPixelation disables smoothing on both draws", async () => {
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      pixelation: nearestPixelation,
    });

    expect(tracked.canvases[1]?.context.smoothingAtDraw).toEqual([false]);
    expect(tracked.canvases[0]?.context.smoothingAtDraw).toEqual([false]);
    expect(tracked.canvases[1]?.width).toBe(4);
  });

  test("rounds or floors the cell count from block size", async () => {
    const rounded = installTrackedCanvases();
    restoreOffscreenCanvas = rounded.restore;

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 100,
      pixelation: { ...nearestPixelation, blockSize: 6 },
    });
    expect(rounded.canvases[1]?.width).toBe(17);

    rounded.restore();
    vi.restoreAllMocks();

    const floored = installTrackedCanvases();
    restoreOffscreenCanvas = floored.restore;
    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 100,
      pixelation: { blockSize: 6, downscale: { rounding: "floor" } },
    });
    expect(floored.canvases[1]?.width).toBe(16);
  });

  test("top-level background fills both pixelation stages", async () => {
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      background: "#fff",
      pixelate: 8,
    });
    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      background: "#fff",
      pixelation: { blockSize: 8 },
    });

    for (const offset of [0, 2]) {
      expect(tracked.canvases[offset]?.context.fills).toEqual([
        { style: "#fff", width: 32, height: 32 },
      ]);
      expect(tracked.canvases[offset + 1]?.context.fills).toEqual([
        { style: "#fff", width: 4, height: 4 },
      ]);
    }
  });

  test("explicit null downscale background fills only the output", async () => {
    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;

    await svgToImageBlob({
      svg: SAMPLE_SVG,
      size: 32,
      background: "#fff",
      pixelation: {
        blockSize: 8,
        downscale: { background: null },
        upscale: { background: "#fff" },
      },
    });

    expect(tracked.canvases[1]?.context.fills).toEqual([]);
    expect(tracked.canvases[0]?.context.fills).toEqual([{ style: "#fff", width: 32, height: 32 }]);
  });

  test("throws IncompatibleOptionsError for blockSize below 2", async () => {
    await expect(
      svgToImageBlob({ svg: SAMPLE_SVG, pixelation: { blockSize: 1 } }),
    ).rejects.toBeInstanceOf(IncompatibleOptionsError);

    const tracked = installTrackedCanvases();
    restoreOffscreenCanvas = tracked.restore;
    await expect(
      svgToImageBlob({ svg: SAMPLE_SVG, size: 32, pixelate: 1 }),
    ).resolves.toBeInstanceOf(Blob);
  });
});
