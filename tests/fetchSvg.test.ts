import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { buildSvgUrl, fetchSvgText } from "../src/fetchSvg.ts";
import { EmojiNotFoundError } from "../src/errors.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import { mockTwemojiFetch, requestUrl, SAMPLE_SVG } from "./helpers.ts";

describe("buildSvgUrl", () => {
  test("builds default Twemoji URLs", () => {
    expect(buildSvgUrl("1f600")).toBe(
      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg/1f600.svg",
    );
  });

  test("builds custom CDN URLs with optional extensions", () => {
    expect(
      buildSvgUrl("1f600", {
        baseUrl: "https://cdn.example.com/assets/",
        ext: ".svg+xml",
      }),
    ).toBe("https://cdn.example.com/assets/1f600.svg+xml");
  });
});

describe("fetchSvgText", () => {
  beforeEach(() => {
    sharedSvgCache.clear();
  });

  test("throws when fetch is unavailable", async () => {
    sharedSvgCache.clear();
    const originalFetch = globalThis.fetch;
    // @ts-expect-error test override
    delete globalThis.fetch;

    try {
      await expect(
        fetchSvgText({
          emoji: "😀",
          fetch: undefined,
          cache: false,
        }),
      ).rejects.toThrow("fetch is not available");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws EmojiNotFoundError for failed responses", async () => {
    const fetchImpl = (async () => new Response(null, { status: 404 })) as typeof fetch;

    await expect(
      fetchSvgText({
        emoji: "😀",
        fetch: fetchImpl,
        cache: false,
      }),
    ).rejects.toBeInstanceOf(EmojiNotFoundError);
  });

  test("does not reuse cache entries across different extensions", async () => {
    const svgMarkup = "<svg>a</svg>";
    const pngMarkup = "<svg>b</svg>";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith(".svg")) {
        return new Response(svgMarkup, { status: 200 });
      }
      if (url.endsWith(".png")) {
        return new Response(pngMarkup, { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const svg = await fetchSvgText({
      emoji: "😀",
      source: { baseUrl: "https://example.com/emoji", ext: ".svg" },
      fetch: fetchImpl,
    });
    const png = await fetchSvgText({
      emoji: "😀",
      source: { baseUrl: "https://example.com/emoji", ext: ".png" },
      fetch: fetchImpl,
    });

    expect(svg).toBe(svgMarkup);
    expect(png).toBe(pngMarkup);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("returns fetched SVG text", async () => {
    const svg = await fetchSvgText({
      emoji: "😀",
      fetch: mockTwemojiFetch(SAMPLE_SVG),
      cache: false,
    });
    expect(svg).toBe(SAMPLE_SVG);
  });
});
