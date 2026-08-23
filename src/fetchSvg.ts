import { emojiToCodePoint } from "./codepoint.ts";
import { EmojiFetchError, EmojiNotFoundError } from "./errors.ts";
import { shouldTryNextSource, throwIfAborted } from "./fallback.ts";
import {
  composeFetchSignal,
  DEFAULT_FETCH_RETRIES,
  DEFAULT_FETCH_TIMEOUT,
  isNotFoundStatus,
  isRetryableFetchError,
  isRetryableFetchStatus,
  sleep,
} from "./fetchHttp.ts";
import { isFluentSource } from "./fluentMeta.ts";
import {
  assertCdnFallbacks,
  buildAssetUrl,
  buildAssetUrlAsync,
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
  timeout?: number;
  retries?: number;
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

async function resolveAssetUrl(emoji: string, source: EmojiSource): Promise<string> {
  const codePoint = emojiToCodePoint(emoji);

  try {
    return await buildAssetUrlAsync(codePoint, source);
  } catch (error) {
    if (error instanceof EmojiNotFoundError) {
      throw new EmojiNotFoundError(emoji, error.url);
    }
    throw error;
  }
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
    timeout = DEFAULT_FETCH_TIMEOUT,
    retries = DEFAULT_FETCH_RETRIES,
    cacheStore = sharedSvgCache,
  } = options;

  const url = await resolveAssetUrl(emoji, source);

  if (cache) {
    const cached = cacheStore.get(url);
    if (cached !== undefined) {
      return cached;
    }
  }

  if (fetchImpl === undefined) {
    throw new Error("fetch is not available in this environment");
  }

  const svgText = await fetchSvgResponse({
    emoji,
    url,
    source,
    fetchImpl,
    signal,
    timeout,
    retries,
  });

  if (cache) {
    cacheStore.set(url, svgText);
  }

  return svgText;
}

interface FetchSvgResponseOptions {
  emoji: string;
  url: string;
  source: EmojiSource;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  timeout: number;
  retries: number;
}

async function fetchSvgResponse(options: FetchSvgResponseOptions): Promise<string> {
  const { emoji, url, source, fetchImpl, signal, timeout, retries } = options;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    throwIfAborted(signal);

    const { signal: fetchSignal } = composeFetchSignal(signal, timeout);

    try {
      const response = await fetchImpl(url, { signal: fetchSignal });

      if (!response.ok) {
        if (isNotFoundStatus(response.status)) {
          throw new EmojiNotFoundError(emoji, url);
        }

        const fetchError = new EmojiFetchError(emoji, url, response.status);

        if (attempt < retries && isRetryableFetchStatus(response.status)) {
          lastError = fetchError;
          attempt += 1;
          await sleep(100 * attempt, signal);
          continue;
        }

        throw fetchError;
      }

      if (isFluentSource(source)) {
        const { isFluent3dSource, wrapPngAsSvg } = await import("./fluent.ts");
        if (isFluent3dSource(source)) {
          return wrapPngAsSvg(await blobToDataUrl(await response.blob()));
        }
      }

      return await response.text();
    } catch (error) {
      if (error instanceof EmojiNotFoundError || error instanceof EmojiFetchError) {
        if (error instanceof EmojiFetchError && attempt < retries) {
          lastError = error;
          attempt += 1;
          await sleep(100 * attempt, signal);
          continue;
        }
        throw error;
      }

      if (isRetryableFetchError(error)) {
        const fetchError = new EmojiFetchError(emoji, url, undefined, { cause: error });
        if (attempt < retries) {
          lastError = fetchError;
          attempt += 1;
          await sleep(100 * attempt, signal);
          continue;
        }
        throw fetchError;
      }

      throw error;
    }
  }

  throw lastError ?? new EmojiFetchError(emoji, url);
}
