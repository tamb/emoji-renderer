import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { DESATURATE_RANGE_MESSAGE } from "../src/desaturate.ts";
import { emojiToSvg } from "../src/emojiToSvg.ts";
import { EmojiNotFoundError, IncompatibleOptionsError, InvalidEmojiError } from "../src/errors.ts";
import {
  PIXELATE_DEPRECATION_WARNING,
  resetPixelateDeprecationForTests,
  smoothPixelation,
} from "../src/pixelation.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import {
  createMockFetch,
  FAMILY_CODEPOINT,
  FAMILY_EMOJI,
  mockCanvas,
  mockTwemojiFetch,
  OPENMOJI_BASE,
  requestUrl,
  SAMPLE_SVG,
  TWEMOJI_BASE,
} from "./helpers.ts";

describe("emojiToSvg", () => {
  beforeEach(() => {
    sharedSvgCache.clear();
  });

  test("returns normalized SVG markup for a single emoji", async () => {
    const fetchImpl = mockTwemojiFetch();
    const svg = await emojiToSvg("😀", { fetch: fetchImpl, size: 48 });

    expect(svg).toContain("<svg");
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
    expect(svg).toContain("<circle");
  });

  test("resolves ZWJ family emoji to compound codepoint", async () => {
    const fetchImpl = vi.fn(mockTwemojiFetch());
    await emojiToSvg(FAMILY_EMOJI, { fetch: fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      `https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg/${FAMILY_CODEPOINT}.svg`,
      expect.any(Object),
    );
  });

  test("strips VS16 from text-default emoji CDN filenames", async () => {
    const fetchImpl = vi.fn(mockTwemojiFetch());
    await emojiToSvg("⚰️", { fetch: fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(`${TWEMOJI_BASE}/26b0.svg`, expect.any(Object));
  });

  test("uses cache on subsequent calls", async () => {
    const fetchImpl = vi.fn(mockTwemojiFetch());
    await emojiToSvg("😀", { fetch: fetchImpl });
    await emojiToSvg("😀", { fetch: fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("skips cache when cache option is false", async () => {
    const fetchImpl = vi.fn(mockTwemojiFetch());
    await emojiToSvg("😀", { fetch: fetchImpl, cache: false });
    await emojiToSvg("😀", { fetch: fetchImpl, cache: false });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("supports custom CDN base URLs", async () => {
    const customBase = "https://example.com/emojis";
    const fetchImpl = vi.fn(createCustomFetch(customBase));

    await emojiToSvg("😀", {
      fetch: fetchImpl,
      source: { baseUrl: customBase },
    });

    expect(fetchImpl).toHaveBeenCalledWith(`${customBase}/1f600.svg`, expect.any(Object));
  });

  test("throws InvalidEmojiError for empty input", async () => {
    await expect(emojiToSvg("   ", { fetch: mockTwemojiFetch() })).rejects.toBeInstanceOf(
      InvalidEmojiError,
    );
  });

  test("throws EmojiNotFoundError when CDN returns 404", async () => {
    const fetchImpl = mockTwemojiFetch();
    const brokenFetch = (async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("1f600.svg")) {
        return new Response(null, { status: 404 });
      }
      return fetchImpl(input);
    }) as typeof fetch;

    await expect(emojiToSvg("😀", { fetch: brokenFetch })).rejects.toBeInstanceOf(
      EmojiNotFoundError,
    );
  });

  test("uses fallbacks when the primary CDN returns 404", async () => {
    const fetchImpl = vi.fn(
      createMockFetch({
        [`${TWEMOJI_BASE}/1f600.svg`]: 404,
        [`${OPENMOJI_BASE}/1F600.svg`]: SAMPLE_SVG,
      }),
    );

    const svg = await emojiToSvg("😀", {
      fetch: fetchImpl,
      fallbacks: ["openmoji"],
      size: 48,
    });

    expect(svg).toContain("<circle");
    expect(svg).toContain('width="48"');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("falls back from an unmapped Fluent glyph", async () => {
    const fetchImpl = vi.fn(
      createMockFetch({
        [`${TWEMOJI_BASE}/${FAMILY_CODEPOINT}.svg`]: SAMPLE_SVG,
      }),
    );

    const svg = await emojiToSvg(FAMILY_EMOJI, {
      source: "fluent",
      fallbacks: ["twemoji"],
      fetch: fetchImpl,
    });

    expect(svg).toContain("<circle");
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg/${FAMILY_CODEPOINT}.svg`,
      expect.any(Object),
    );
  });

  test("can include an XML declaration", async () => {
    const svg = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(),
      xmlDeclaration: true,
    });

    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain('width="72"');
    expect(svg).toContain("<circle");
  });

  test("returns a raster-backed SVG when pixelate is enabled", async () => {
    const restoreOffscreenCanvas = mockCanvas();

    try {
      const svg = await emojiToSvg("😀", {
        fetch: mockTwemojiFetch(),
        size: 48,
        pixelate: 8,
      });

      expect(svg).toContain("<image");
      expect(svg).toContain('href="data:image/png');
      expect(svg).not.toContain("<circle");
    } finally {
      restoreOffscreenCanvas();
    }
  });

  test("returns viewBox-only SVG when responsive is enabled", async () => {
    const svg = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(),
      responsive: true,
    });

    expect(svg).toContain('viewBox="0 0 36 36"');
    expect(svg).not.toMatch(/\swidth="/);
  });

  test("throws when responsive is combined with pixelate", async () => {
    const restoreOffscreenCanvas = mockCanvas();

    try {
      await expect(
        emojiToSvg("😀", {
          fetch: mockTwemojiFetch(),
          pixelate: 8,
          responsive: true,
        }),
      ).rejects.toThrow(
        "responsive is incompatible with pixelate on emojiToSvg because pixelated output embeds a raster image",
      );
    } finally {
      restoreOffscreenCanvas();
    }
  });

  test("returns a raster-backed SVG for smoothPixelation", async () => {
    const restoreOffscreenCanvas = mockCanvas();

    try {
      const svg = await emojiToSvg("😀", {
        fetch: mockTwemojiFetch(),
        size: 48,
        pixelation: smoothPixelation,
      });

      expect(svg).toContain("<image");
      expect(svg).toContain('href="data:image/png');
      expect(svg).not.toContain("<circle");
    } finally {
      restoreOffscreenCanvas();
    }
  });

  test("throws when responsive is combined with pixelation", async () => {
    await expect(
      emojiToSvg("😀", {
        fetch: mockTwemojiFetch(),
        pixelation: { blockSize: 8 },
        responsive: true,
      }),
    ).rejects.toThrow(
      "responsive is incompatible with pixelation on emojiToSvg because pixelated output embeds a raster image",
    );
  });

  test("allows responsive when pixelate is below 2", async () => {
    resetPixelateDeprecationForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const svg = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(),
      pixelate: 1,
      responsive: true,
    });

    expect(warn).not.toHaveBeenCalled();
    expect(svg).toContain('viewBox="0 0 36 36"');
    expect(svg).not.toMatch(/\swidth="/);
  });

  test("throws IncompatibleOptionsError for pixelation blockSize below 2", async () => {
    await expect(emojiToSvg("😀", { pixelation: { blockSize: 1 } })).rejects.toBeInstanceOf(
      IncompatibleOptionsError,
    );
  });

  test("adds a saturate filter for partial and full desaturation", async () => {
    const partial = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(),
      desaturate: 0.2,
      xmlDeclaration: true,
    });
    expect(partial.startsWith("<?xml")).toBe(true);
    expect(partial).toContain('feColorMatrix type="saturate" values="0.8"');
    expect(partial).toContain("<circle");

    const full = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(),
      desaturate: true,
      responsive: true,
    });
    expect(full).toContain('feColorMatrix type="saturate" values="0"');
    expect(full).not.toMatch(/\swidth="/);
  });

  test("leaves markup unchanged when desaturate is off", async () => {
    const svg = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(),
      desaturate: 0,
    });
    expect(svg).not.toContain("feColorMatrix");
    expect(svg).toContain("<circle");
  });

  test("desaturates the embedded PNG when pixelation is also set", async () => {
    const restoreOffscreenCanvas = mockCanvas();
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const getImageData = vi.fn(() => ({ data, width: 1, height: 1 }));
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "low",
      getImageData,
      putImageData,
    } as unknown as CanvasRenderingContext2D);

    try {
      const svg = await emojiToSvg("😀", {
        fetch: mockTwemojiFetch(),
        size: 32,
        pixelation: { blockSize: 8 },
        desaturate: true,
      });

      expect(getImageData).toHaveBeenCalledWith(0, 0, 32, 32);
      expect(putImageData).toHaveBeenCalled();
      expect(Array.from(data)).toEqual([54, 54, 54, 255]);
      expect(svg).toContain("<image");
      expect(svg).not.toContain("feColorMatrix");
    } finally {
      restoreOffscreenCanvas();
    }
  });

  test("throws when desaturate is not a 0 to 1 number", async () => {
    const fetchImpl = vi.fn(mockTwemojiFetch());
    await expect(emojiToSvg("😀", { fetch: fetchImpl, desaturate: 2 })).rejects.toThrow(
      DESATURATE_RANGE_MESSAGE,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("warns once when pixelate is coerced for a raster SVG", async () => {
    resetPixelateDeprecationForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const restoreOffscreenCanvas = mockCanvas();

    try {
      await emojiToSvg("😀", {
        fetch: mockTwemojiFetch(),
        size: 48,
        pixelate: 8,
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(PIXELATE_DEPRECATION_WARNING);
    } finally {
      restoreOffscreenCanvas();
    }
  });
});

function createCustomFetch(baseUrl: string): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.startsWith(baseUrl)) {
      return new Response(SAMPLE_SVG, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;
}
