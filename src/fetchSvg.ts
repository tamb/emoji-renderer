import { emojiToCodePoint } from "./codepoint.ts";
import { EmojiNotFoundError } from "./errors.ts";
import { shouldTryNextSource, throwIfAborted } from "./fallback.ts";
import {
  isFluentRasterStyle,
  isFluentSource,
  resolveFluentSource,
  wrapPngAsSvg,
} from "./fluent.ts";
import {
  assertCdnFallbacks,
  buildAssetUrl,
  DEFAULT_SVG_SOURCE,
  resolveSourceChain,
} from "./sources.ts";
import { sharedSvgCache, type SvgCache } from "./svgCache.ts";
import { blobToDataUrl } from "./svgToImage.ts";
import type { EmojiCdnPreset, EmojiSource } from "./types.ts";

export interface FetchSvgOptions {
  emoji: string;
  source?: EmojiSource;
  fallbacks?: EmojiCdnPreset[];
  fetch?: typeof fetch;
  cache?: boolean;
  signal?: AbortSignal;
  cacheStore?: SvgCache;
}

export function buildSvgUrl(codePoint: string, source: EmojiSource = DEFAULT_SVG_SOURCE): string {
  return buildAssetUrl(codePoint, source);
}

export async function fetchSvgText(options: FetchSvgOptions): Promise<string> {
  const { source = DEFAULT_SVG_SOURCE, fallbacks = [] } = options;
  assertCdnFallbacks(fallbacks);

  const sources = resolveSourceChain(source, fallbacks);
  let lastError: unknown;

  for (const candidate of sources) {
    throwIfAborted(options.signal);

    try {
      return await fetchSvgTextFromSource({ ...options, source: candidate });
    } catch (error) {
      if (!shouldTryNextSource(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("No emoji source succeeded");
}

async function fetchSvgTextFromSource(
  options: FetchSvgOptions & { source: EmojiSource },
): Promise<string> {
  const {
    emoji,
    source,
    fetch: fetchImpl = globalThis.fetch,
    cache = true,
    signal,
    cacheStore = sharedSvgCache,
  } = options;

  const codePoint = emojiToCodePoint(emoji);
  let url: string;
  try {
    url = buildAssetUrl(codePoint, source);
  } catch (error) {
    if (error instanceof EmojiNotFoundError) {
      throw new EmojiNotFoundError(emoji, error.url);
    }
    throw error;
  }

  if (cache) {
    const cached = cacheStore.get(url);
    if (cached !== undefined) {
      return cached;
    }
  }

  if (fetchImpl === undefined) {
    throw new Error("fetch is not available in this environment");
  }

  const response = await fetchImpl(url, { signal });
  if (!response.ok) {
    throw new EmojiNotFoundError(emoji, url);
  }

  const svgText = isFluent3dSource(source)
    ? wrapPngAsSvg(await blobToDataUrl(await response.blob()))
    : await response.text();

  if (cache) {
    cacheStore.set(url, svgText);
  }

  return svgText;
}

function isFluent3dSource(source: EmojiSource): boolean {
  return isFluentSource(source) && isFluentRasterStyle(resolveFluentSource(source).style);
}
