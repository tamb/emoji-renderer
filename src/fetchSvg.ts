import { emojiToCodePoint } from "./codepoint.ts";
import { EmojiNotFoundError } from "./errors.ts";
import { buildAssetUrl, DEFAULT_SVG_SOURCE } from "./sources.ts";
import { sharedSvgCache, type SvgCache } from "./svgCache.ts";
import type { EmojiSource } from "./types.ts";

export interface FetchSvgOptions {
  emoji: string;
  source?: EmojiSource;
  fetch?: typeof fetch;
  cache?: boolean;
  signal?: AbortSignal;
  cacheStore?: SvgCache;
}

export function buildSvgUrl(codePoint: string, source: EmojiSource = DEFAULT_SVG_SOURCE): string {
  return buildAssetUrl(codePoint, source);
}

export async function fetchSvgText(options: FetchSvgOptions): Promise<string> {
  const {
    emoji,
    source = DEFAULT_SVG_SOURCE,
    fetch: fetchImpl = globalThis.fetch,
    cache = true,
    signal,
    cacheStore = sharedSvgCache,
  } = options;

  const codePoint = emojiToCodePoint(emoji);
  const url = buildAssetUrl(codePoint, source);

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

  const svgText = await response.text();

  if (cache) {
    cacheStore.set(url, svgText);
  }

  return svgText;
}
