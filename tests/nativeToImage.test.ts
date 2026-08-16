import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { InvalidEmojiError, RasterizeError } from "../src/errors.ts";
import {
  nativeEmojiToDataUrl,
  nativeEmojiToHtmlImage,
  nativeEmojiToImageBlob,
} from "../src/nativeToImage.ts";
import { mockCanvas } from "./helpers.ts";

function mock2dContext(
  overrides: Partial<CanvasRenderingContext2D> = {},
): CanvasRenderingContext2D {
  return {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    font: "",
    textAlign: "",
    textBaseline: "",
    imageSmoothingEnabled: true,
    ...overrides,
  } as unknown as CanvasRenderingContext2D;
}

describe("nativeToImage", () => {
  let restoreOffscreenCanvas: (() => void) | undefined;

  afterEach(() => {
    restoreOffscreenCanvas?.();
    restoreOffscreenCanvas = undefined;
    vi.restoreAllMocks();
  });

  test("draws emoji text centered on canvas", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillText = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mock2dContext({ fillText }),
    );

    await nativeEmojiToImageBlob({ emoji: "🎉", size: 48, fontFamily: "Test Emoji" });

    expect(fillText).toHaveBeenCalledWith("🎉", 24, 24);
  });

  test("fills background when provided", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillRect = vi.fn();
    const context = mock2dContext({ fillRect });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    await nativeEmojiToImageBlob({ emoji: "🎉", size: 32, background: "#112233" });

    expect(fillRect).toHaveBeenCalledWith(0, 0, 32, 32);
    expect(context.fillStyle).toBe("#000");
  });

  test("pixelates output with nearest-neighbor scaling", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const drawImage = vi.fn();
    const context = mock2dContext({ drawImage });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    const blob = await nativeEmojiToImageBlob({
      emoji: "🎉",
      size: 32,
      pixelate: 8,
      background: "#ffffff",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(drawImage).toHaveBeenCalled();
    expect(context.imageSmoothingEnabled).toBe(true);
  });

  test("returns a data URL", async () => {
    restoreOffscreenCanvas = mockCanvas();

    const dataUrl = await nativeEmojiToDataUrl({ emoji: "🎉", size: 24 });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("returns an HTMLImageElement sized to the request", async () => {
    restoreOffscreenCanvas = mockCanvas();

    const image = await nativeEmojiToHtmlImage({ emoji: "🎉", size: 40 });

    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.width).toBe(40);
    expect(image.height).toBe(40);
    expect(image.src.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("throws InvalidEmojiError for empty emoji", async () => {
    restoreOffscreenCanvas = mockCanvas();

    await expect(nativeEmojiToImageBlob({ emoji: "  " })).rejects.toBeInstanceOf(InvalidEmojiError);
  });

  test("wraps unexpected errors as RasterizeError", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(nativeEmojiToImageBlob({ emoji: "🎉" })).rejects.toBeInstanceOf(RasterizeError);
  });
});
