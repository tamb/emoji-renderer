import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { RasterizeError } from "../src/errors.ts";
import { svgToDataUrl, svgToHtmlImage, svgToImageBlob } from "../src/svgToImage.ts";
import { mockCanvas, SAMPLE_SVG } from "./helpers.ts";

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

  test("throws RasterizeError when canvas is unavailable", async () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error test override
    delete globalThis.document;
    // @ts-expect-error test override
    delete globalThis.OffscreenCanvas;

    await expect(
      svgToImageBlob({
        svg: SAMPLE_SVG,
      }),
    ).rejects.toThrow("Canvas is not available");

    globalThis.document = originalDocument;
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
});
