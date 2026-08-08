import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { emojiToSvg } from "../src/emojiToSvg.ts";
import { EmojiNotFoundError, IncompatibleOptionsError, InvalidEmojiError } from "../src/errors.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import {
  FAMILY_CODEPOINT,
  FAMILY_EMOJI,
  mockCanvas,
  mockTwemojiFetch,
  requestUrl,
  SAMPLE_SVG,
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
      ).rejects.toBeInstanceOf(IncompatibleOptionsError);
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
