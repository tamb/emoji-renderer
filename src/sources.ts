import { IncompatibleOptionsError } from "./errors.ts";
import { isFluentSource, resolveFluentSource } from "./fluentMeta.ts";
import type { CodePointFormat, EmojiCdnPreset, EmojiSource } from "./types.ts";

export const DEFAULT_SVG_SOURCE: EmojiCdnPreset = "twemoji";
export const DEFAULT_IMAGE_SOURCE: EmojiCdnPreset = "twemoji";
export const EMOJI_CDN_PRESETS: readonly EmojiCdnPreset[] = [
  "twemoji",
  "openmoji",
  "noto",
  "fluent",
];

type CodePointCdnPreset = Exclude<EmojiCdnPreset, "fluent">;

const PRESET_BASES: Record<CodePointCdnPreset, string> = {
  twemoji: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg",
  openmoji: "https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg",
  noto: "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg",
};

/**
 * Formats a Twemoji-style codepoint (`1f600`, `1f468-200d-1f469`) for a given asset set.
 */
export function formatCodePoint(codePoint: string, format: CodePointFormat = "twemoji"): string {
  switch (format) {
    case "openmoji":
      return codePoint.toUpperCase();
    case "noto":
      return `emoji_u${codePoint.replaceAll("-", "_").toLowerCase()}`;
    case "twemoji":
      return codePoint.toLowerCase();
  }
}

export function resolveSourceConfig(source: EmojiSource = DEFAULT_SVG_SOURCE): {
  baseUrl: string;
  ext: string;
  codePointFormat: CodePointFormat;
} {
  if (isFluentSource(source)) {
    throw new Error("Fluent sources do not use codepoint filename stems");
  }

  if (typeof source === "string") {
    return {
      baseUrl: PRESET_BASES[source],
      ext: ".svg",
      codePointFormat: source,
    };
  }

  return {
    baseUrl: source.baseUrl.replace(/\/$/, ""),
    ext: source.ext ?? ".svg",
    codePointFormat: source.codePointFormat ?? "twemoji",
  };
}

export function buildAssetUrl(codePoint: string, source: EmojiSource = DEFAULT_SVG_SOURCE): string {
  if (isFluentSource(source)) {
    throw new Error(
      'buildAssetUrl does not resolve Fluent sources synchronously. Use source: "fluent" with emojiToSvg or emojiToImage.',
    );
  }

  const { baseUrl, ext, codePointFormat } = resolveSourceConfig(source);
  const fileStem = formatCodePoint(codePoint, codePointFormat);
  return `${baseUrl}/${fileStem}${ext}`;
}

export function isEmojiCdnPreset(value: string): value is EmojiCdnPreset {
  return (EMOJI_CDN_PRESETS as readonly string[]).includes(value);
}

export function assertCdnFallbacks(
  fallbacks: readonly string[],
): asserts fallbacks is readonly EmojiCdnPreset[] {
  for (const source of fallbacks) {
    if (!isEmojiCdnPreset(source)) {
      throw new IncompatibleOptionsError(
        `Unknown fallback source "${source}". Supported sources: ${EMOJI_CDN_PRESETS.join(", ")}`,
      );
    }
  }
}

export function sourceIdentity(source: EmojiSource): string {
  if (isFluentSource(source)) {
    const resolved = resolveFluentSource(source);
    return `fluent|${resolved.style}|${resolved.baseUrl}`;
  }

  if (typeof source === "string") {
    return source;
  }

  const resolved = resolveSourceConfig(source);
  return `custom|${resolved.baseUrl}|${resolved.ext}|${resolved.codePointFormat}`;
}

export function resolveSourceChain(
  primary: EmojiSource,
  fallbacks: readonly EmojiCdnPreset[] = [],
): EmojiSource[] {
  const seen = new Set<string>();
  const sources: EmojiSource[] = [];

  for (const source of [primary, ...fallbacks]) {
    const id = sourceIdentity(source);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    sources.push(source);
  }

  return sources;
}

export async function buildAssetUrlAsync(
  codePoint: string,
  source: EmojiSource = DEFAULT_SVG_SOURCE,
): Promise<string> {
  if (isFluentSource(source)) {
    const { buildFluentAssetUrl } = await import("./fluent.ts");
    return buildFluentAssetUrl(codePoint, source);
  }

  return buildAssetUrl(codePoint, source);
}
