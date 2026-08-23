import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { emojiToImage } from "../src/emojiToImage.ts";
import { IncompatibleOptionsError } from "../src/errors.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import {
  createMockFetch,
  mockCanvas,
  mockFluentFetch,
  mockNotoFetch,
  mockOpenmojiFetch,
  mockTwemojiFetch,
  OPENMOJI_BASE,
  TWEMOJI_BASE,
} from "./helpers.ts";

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

  test("defaults to Twemoji and fetches CDN SVG", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fetchImpl = vi.fn(mockTwemojiFetch());
    const image = await emojiToImage("😀", {
      fetch: fetchImpl,
      size: 32,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.width).toBe(32);
    expect(image.height).toBe(32);
  });

  test("returns a Blob when format is blob", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const blob = await emojiToImage("😀", {
      format: "blob",
      fetch: mockTwemojiFetch(),
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("returns a data URL when format is dataUrl", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const dataUrl = await emojiToImage("😀", {
      format: "dataUrl",
      fetch: mockTwemojiFetch(),
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

  test("fetches the Fluent preset", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fluentFetch = vi.fn(mockFluentFetch());

    await emojiToImage("😀", { source: "fluent", fetch: fluentFetch, format: "blob" });

    expect(fluentFetch).toHaveBeenCalledTimes(1);
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
      fetch: mockTwemojiFetch(),
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
      fetch: mockTwemojiFetch(),
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
      fetch: mockTwemojiFetch(),
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

  test("uses fallbacks when the primary CDN returns 404", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fetchImpl = vi.fn(
      createMockFetch({
        [`${TWEMOJI_BASE}/1f600.svg`]: 404,
        [`${OPENMOJI_BASE}/1F600.svg`]:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18"/></svg>',
      }),
    );

    const blob = await emojiToImage("😀", {
      source: "twemoji",
      fallbacks: ["openmoji"],
      fetch: fetchImpl,
      format: "blob",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("draws native emoji when fallbackToNative is set and CDNs fail", async () => {
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

    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch;

    const blob = await emojiToImage("😀", {
      source: "twemoji",
      fallbacks: ["openmoji"],
      fallbackToNative: true,
      fetch: fetchImpl,
      format: "blob",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(fillText).toHaveBeenCalledWith("😀", 36, 36);
    expect(fetchImpl).toHaveBeenCalled();
  });

  test("still throws when CDNs fail and fallbackToNative is false", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch;

    await expect(
      emojiToImage("😀", {
        source: "twemoji",
        fallbacks: ["noto"],
        fetch: fetchImpl,
        format: "blob",
      }),
    ).rejects.toMatchObject({ name: "EmojiNotFoundError" });
  });
});
