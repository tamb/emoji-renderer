import { emojiToCodePoint } from "./codepoint.ts";
import { EmojiNotFoundError } from "./errors.ts";
import { sharedSvgCache, type SvgCache } from "./svgCache.ts";
import type { EmojiSource } from "./types.ts";

const DEFAULT_TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg";

export interface FetchSvgOptions {
  emoji: string;
  source?: EmojiSource;
  fetch?: typeof fetch;
  cache?: boolean;
  signal?: AbortSignal;
  cacheStore?: SvgCache;
}

export function buildSvgUrl(codePoint: string, source: EmojiSource = "twemoji"): string {
  if (source === "twemoji") {
    return `${DEFAULT_TWEMOJI_BASE}/${codePoint}.svg`;
  }

  const ext = source.ext ?? ".svg";
  const normalizedBase = source.baseUrl.replace(/\/$/, "");
  return `${normalizedBase}/${codePoint}${ext}`;
}

export async function fetchSvgText(options: FetchSvgOptions): Promise<string> {
  const {
    emoji,
    source = "twemoji",
    fetch: fetchImpl = globalThis.fetch,
    cache = true,
    signal,
    cacheStore = sharedSvgCache,
  } = options;

  const codePoint = emojiToCodePoint(emoji);
  const url = buildSvgUrl(codePoint, source);

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
