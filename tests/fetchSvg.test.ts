import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { buildSvgUrl, fetchSvgText } from "../src/fetchSvg.ts";
import { EmojiNotFoundError, IncompatibleOptionsError } from "../src/errors.ts";
import { buildAssetUrl, formatCodePoint, resolveSourceChain } from "../src/sources.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import {
  createMockFetch,
  FAMILY_CODEPOINT,
  FAMILY_CODEPOINT_NOTO,
  FAMILY_CODEPOINT_OPENMOJI,
  mockTwemojiFetch,
  NOTO_BASE,
  OPENMOJI_BASE,
  requestUrl,
  SAMPLE_SVG,
  TWEMOJI_BASE,
} from "./helpers.ts";

describe("formatCodePoint", () => {
  test("formats Twemoji, OpenMoji, and Noto stems", () => {
    expect(formatCodePoint("1f600")).toBe("1f600");
    expect(formatCodePoint("1f600", "openmoji")).toBe("1F600");
    expect(formatCodePoint("1f600", "noto")).toBe("emoji_u1f600");
    expect(formatCodePoint(FAMILY_CODEPOINT, "openmoji")).toBe(FAMILY_CODEPOINT_OPENMOJI);
    expect(formatCodePoint(FAMILY_CODEPOINT, "noto")).toBe(FAMILY_CODEPOINT_NOTO);
  });
});

describe("buildSvgUrl", () => {
  test("builds default Twemoji URLs", () => {
    expect(buildSvgUrl("1f600")).toBe(`${TWEMOJI_BASE}/1f600.svg`);
  });

  test("builds OpenMoji and Noto preset URLs", () => {
    expect(buildAssetUrl("1f600", "openmoji")).toBe(`${OPENMOJI_BASE}/1F600.svg`);
    expect(buildAssetUrl("1f600", "noto")).toBe(`${NOTO_BASE}/emoji_u1f600.svg`);
    expect(buildAssetUrl(FAMILY_CODEPOINT, "openmoji")).toBe(
      `${OPENMOJI_BASE}/${FAMILY_CODEPOINT_OPENMOJI}.svg`,
    );
    expect(buildAssetUrl(FAMILY_CODEPOINT, "noto")).toBe(
      `${NOTO_BASE}/${FAMILY_CODEPOINT_NOTO}.svg`,
    );
  });

  test("builds custom CDN URLs with optional extensions and formats", () => {
    expect(
      buildSvgUrl("1f600", {
        baseUrl: "https://cdn.example.com/assets/",
        ext: ".svg+xml",
      }),
    ).toBe("https://cdn.example.com/assets/1f600.svg+xml");

    expect(
      buildAssetUrl("1f600", {
        baseUrl: "https://cdn.example.com/openmoji",
        codePointFormat: "openmoji",
      }),
    ).toBe("https://cdn.example.com/openmoji/1F600.svg");
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

  test("tries fallbacks after the primary source 404s", async () => {
    const fetchImpl = vi.fn(
      createMockFetch({
        [`${TWEMOJI_BASE}/1f600.svg`]: 404,
        [`${OPENMOJI_BASE}/1F600.svg`]: SAMPLE_SVG,
      }),
    );

    const svg = await fetchSvgText({
      emoji: "😀",
      source: "twemoji",
      fallbacks: ["openmoji"],
      fetch: fetchImpl,
      cache: false,
    });

    expect(svg).toBe(SAMPLE_SVG);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, `${TWEMOJI_BASE}/1f600.svg`, expect.any(Object));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `${OPENMOJI_BASE}/1F600.svg`, expect.any(Object));
  });

  test("skips fallbacks that match the primary source", async () => {
    const fetchImpl = vi.fn(
      createMockFetch({
        [`${TWEMOJI_BASE}/1f600.svg`]: 404,
        [`${NOTO_BASE}/emoji_u1f600.svg`]: SAMPLE_SVG,
      }),
    );

    await fetchSvgText({
      emoji: "😀",
      source: "twemoji",
      fallbacks: ["twemoji", "noto"],
      fetch: fetchImpl,
      cache: false,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `${NOTO_BASE}/emoji_u1f600.svg`,
      expect.any(Object),
    );
  });

  test("throws IncompatibleOptionsError for unknown fallbacks", async () => {
    await expect(
      fetchSvgText({
        emoji: "😀",
        fallbacks: ["not-a-source"] as unknown as ["twemoji"],
        fetch: mockTwemojiFetch(),
      }),
    ).rejects.toBeInstanceOf(IncompatibleOptionsError);
  });

  test("tries fallbacks after a network error", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes(TWEMOJI_BASE)) {
        throw new TypeError("Failed to fetch");
      }
      if (url === `${OPENMOJI_BASE}/1F600.svg`) {
        return new Response(SAMPLE_SVG, { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const svg = await fetchSvgText({
      emoji: "😀",
      fallbacks: ["openmoji"],
      fetch: fetchImpl,
      cache: false,
    });

    expect(svg).toBe(SAMPLE_SVG);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("does not try fallbacks after abort", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("The operation was aborted.", "AbortError");
    }) as typeof fetch;

    await expect(
      fetchSvgText({
        emoji: "😀",
        fallbacks: ["openmoji"],
        fetch: fetchImpl,
        signal: controller.signal,
        cache: false,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("resolveSourceChain", () => {
  test("dedupes fluent string and object with the same style", () => {
    expect(resolveSourceChain("fluent", ["fluent"])).toEqual(["fluent"]);
    expect(resolveSourceChain({ preset: "fluent" }, ["fluent"])).toEqual([{ preset: "fluent" }]);
  });
});
