import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { emojiToImage } from "../src/emojiToImage.ts";
import { IncompatibleOptionsError } from "../src/errors.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import { mockCanvas, mockTwemojiFetch } from "./helpers.ts";
import { parseHtmlSrcset } from "./parseHtmlSrcset.ts";

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

  test("returns an HTMLImageElement by default", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const image = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(),
      size: 32,
    });

    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.width).toBe(32);
    expect(image.height).toBe(32);
    expect(image.src.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("does not revoke the URL used as image.src", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    const image = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(),
      size: 32,
    });

    expect(revoke).not.toHaveBeenCalled();
    expect(image.src.length).toBeGreaterThan(0);
  });

  test("returns a Blob when format is blob", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const blob = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(),
      format: "blob",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("returns a data URL when format is dataUrl", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const dataUrl = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(),
      format: "dataUrl",
    });

    expect(typeof dataUrl).toBe("string");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("reuses cached SVG between calls", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fetchImpl = vi.fn(mockTwemojiFetch());

    await emojiToImage("😀", { fetch: fetchImpl, format: "blob" });
    await emojiToImage("😀", { fetch: fetchImpl, format: "dataUrl" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
      fetch: mockTwemojiFetch(),
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
      fetch: mockTwemojiFetch(),
      size: 40,
      responsive: true,
    });

    expect(image.style.width).toBe("40px");
    expect(image.style.height).toBe("40px");

    vi.unstubAllGlobals();
  });

  test("HTML srcset parsing splits data URLs on the metadata comma", () => {
    const dataUrlSrcset = "data:image/png;base64,abc 24w, data:image/png;base64,def 48w";
    expect(parseHtmlSrcset(dataUrlSrcset)).toHaveLength(4);
  });

  test("builds srcset descriptors for logical widths", async () => {
    restoreOffscreenCanvas = mockCanvas();
    vi.stubGlobal("devicePixelRatio", 2);

    const image = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(),
      size: 48,
      srcSet: [24, 48],
      sizes: "(max-width: 600px) 24px, 48px",
      responsive: { dpr: 2, display: "css" },
    });

    const candidates = parseHtmlSrcset(image.srcset);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.descriptors)).toEqual(["48w", "96w"]);
    expect(candidates.every((candidate) => candidate.url.startsWith("blob:"))).toBe(true);
    expect(image.sizes).toBe("(max-width: 600px) 24px, 48px");

    vi.unstubAllGlobals();
  });

  test("throws when srcSet is used with blob format", async () => {
    restoreOffscreenCanvas = mockCanvas();

    await expect(
      emojiToImage("😀", {
        fetch: mockTwemojiFetch(),
        format: "blob",
        srcSet: [24, 48],
      }),
    ).rejects.toBeInstanceOf(IncompatibleOptionsError);
  });
});
