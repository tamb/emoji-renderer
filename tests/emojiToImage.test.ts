import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { emojiToImage } from "../src/emojiToImage.ts";
import { IncompatibleOptionsError } from "../src/errors.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import { mockCanvas, mockNotoFetch, mockOpenmojiFetch, mockTwemojiFetch } from "./helpers.ts";

describe("emojiToImage", () => {
  let restoreOffscreenCanvas: (() => void) | undefined;

  beforeEach(() => {
    sharedSvgCache.clear();
  });

  afterEach(() => {
    restoreOffscreenCanvas?.();
    restoreOffscreenCanvas = undefined;
    vi.restoreAllMocks();
  });

  test("defaults to native and skips CDN fetch", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillText = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText,
      font: "",
      textAlign: "",
      textBaseline: "",
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);

    const fetchImpl = vi.fn(mockTwemojiFetch());
    const image = await emojiToImage("😀", {
      fetch: fetchImpl,
      size: 32,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fillText).toHaveBeenCalledWith("😀", 16, 16);
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.width).toBe(32);
    expect(image.height).toBe(32);
  });

  test("returns a Blob when format is blob", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const blob = await emojiToImage("😀", {
      format: "blob",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("returns a data URL when format is dataUrl", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const dataUrl = await emojiToImage("😀", {
      format: "dataUrl",
    });

    expect(typeof dataUrl).toBe("string");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("reuses cached SVG between CDN calls", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fetchImpl = vi.fn(mockTwemojiFetch());

    await emojiToImage("😀", { source: "twemoji", fetch: fetchImpl, format: "blob" });
    await emojiToImage("😀", { source: "twemoji", fetch: fetchImpl, format: "dataUrl" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("fetches OpenMoji and Noto presets", async () => {
    restoreOffscreenCanvas = mockCanvas();

    const openmojiFetch = vi.fn(mockOpenmojiFetch());
    const notoFetch = vi.fn(mockNotoFetch());

    await emojiToImage("😀", { source: "openmoji", fetch: openmojiFetch, format: "blob" });
    await emojiToImage("😀", { source: "noto", fetch: notoFetch, format: "blob" });

    expect(openmojiFetch).toHaveBeenCalledTimes(1);
    expect(notoFetch).toHaveBeenCalledTimes(1);
  });

  test("passes background color through to rasterization", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect,
      drawImage: vi.fn(),
      fillText: vi.fn(),
      font: "",
      textAlign: "",
      textBaseline: "",
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);

    await emojiToImage("😀", {
      format: "blob",
      background: "#000000",
    });

    expect(fillRect).toHaveBeenCalled();
  });

  test("renders with source native without fetching SVG", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillText = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText,
      font: "",
      textAlign: "",
      textBaseline: "",
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);

    const fetchImpl = vi.fn(mockTwemojiFetch());

    const blob = await emojiToImage("😀", {
      source: "native",
      format: "blob",
      fetch: fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fillText).toHaveBeenCalledWith("😀", 36, 36);
    expect(blob).toBeInstanceOf(Blob);
  });

  test("throws InvalidEmojiError for empty emoji with source native", async () => {
    restoreOffscreenCanvas = mockCanvas();

    await expect(emojiToImage("  ", { source: "native", format: "blob" })).rejects.toMatchObject({
      name: "InvalidEmojiError",
    });
  });

  test("applies CSS display sizing when responsive is enabled", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.stubGlobal("devicePixelRatio", 1);

    const image = await emojiToImage("😀", {
      size: 40,
      responsive: true,
    });

    expect(image.style.width).toBe("40px");
    expect(image.style.height).toBe("40px");

    vi.unstubAllGlobals();
  });

  test("builds srcset descriptors for logical widths", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.stubGlobal("devicePixelRatio", 2);

    const image = await emojiToImage("😀", {
      size: 48,
      srcSet: [24, 48],
      sizes: "(max-width: 600px) 24px, 48px",
      responsive: { dpr: 2, display: "css" },
    });

    expect(image.srcset).toContain(" 48w");
    expect(image.srcset).toContain(" 96w");
    expect(image.sizes).toBe("(max-width: 600px) 24px, 48px");

    vi.unstubAllGlobals();
  });

  test("throws when srcSet is used with blob format", async () => {
    restoreOffscreenCanvas = mockCanvas();

    await expect(
      emojiToImage("😀", {
        format: "blob",
        srcSet: [24, 48],
      }),
    ).rejects.toBeInstanceOf(IncompatibleOptionsError);
  });
});
