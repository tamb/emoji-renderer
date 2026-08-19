import type { CodePointFormat, EmojiCdnPreset, EmojiSource } from "./types.ts";

export const DEFAULT_SVG_SOURCE: EmojiCdnPreset = "twemoji";
export const DEFAULT_IMAGE_SOURCE = "native" as const;

const PRESET_BASES: Record<EmojiCdnPreset, string> = {
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
  const { baseUrl, ext, codePointFormat } = resolveSourceConfig(source);
  const fileStem = formatCodePoint(codePoint, codePointFormat);
  return `${baseUrl}/${fileStem}${ext}`;
}
