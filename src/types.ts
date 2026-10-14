import type { PixelationOptions } from "./pixelation.ts";

export type CodePointFormat = "twemoji" | "openmoji" | "noto";

export type FluentStyle = "flat" | "color" | "high-contrast" | "3d";

export type EmojiCdnPreset = "twemoji" | "openmoji" | "noto" | "fluent";

export interface CustomEmojiSource {
  baseUrl: string;
  ext?: string;
  /** Filename stem style derived from the Twemoji-style codepoint. Default: `"twemoji"`. */
  codePointFormat?: CodePointFormat;
}

export interface FluentEmojiSource {
  preset: "fluent";
  /** Artwork style. Default: `"color"`. `"3d"` is PNG wrapped in SVG. */
  style?: FluentStyle;
  /** Override the pinned Fluent assets root. Trailing slashes are trimmed. */
  baseUrl?: string;
}

export type EmojiSource = EmojiCdnPreset | CustomEmojiSource | FluentEmojiSource;

export interface EmojiBaseOptions {
  source?: EmojiSource;
  /**
   * CDN presets to try in order after `source` fails to fetch or resolve.
   * Duplicates of `source` are skipped. Default: none.
   */
  fallbacks?: EmojiCdnPreset[];
  size?: number;
  fetch?: typeof fetch;
  cache?: boolean;
  signal?: AbortSignal;
  /** Per-request fetch timeout in milliseconds. Default: 8000. Composed with `signal`. */
  timeout?: number;
  /** Same-source retry count for transient fetch failures (network, 429, 5xx). Default: 2. */
  retries?: number;
}

export type ResponsiveSvgMode = "intrinsic" | "relative" | "fill";

export interface ResponsiveSvgOptions {
  mode?: ResponsiveSvgMode;
  width?: string;
  height?: string;
  viewBox?: string;
}

export type ResponsiveSvg = boolean | ResponsiveSvgOptions;

export interface EmojiToSvgOptions extends EmojiBaseOptions {
  xmlDeclaration?: boolean;
  responsive?: ResponsiveSvg;
  /**
   * @deprecated Removed in v2. Use `pixelation`.
   *
   * `pixelate` is a `number`. `pixelation` is a `PixelationOptions` object.
   * Those are different types and are not merged: when both are set, the object
   * is used as given and this number is not copied into `blockSize` or either stage.
   *
   * Until v2, values `>= 2` rasterize the emoji and embed the pixelated PNG
   * inside an SVG wrapper (Twemoji paths are vector and cannot be pixelated
   * directly). That number is coerced to `{ blockSize: pixelate }` with smooth
   * defaults (bilinear downscale, nearest upscale, `rounding: "floor"`).
   * Values below 2 mean off, do not warn, and are not coerced. The `>=` check
   * uses JavaScript ToNumber, so a numeric string counts as on. v2 removes
   * this option, that coercion, and that ToNumber check.
   */
  pixelate?: number;
  /**
   * Downscale and upscale settings. Wins over `pixelate` when both are set.
   * `blockSize` must be a finite number `>= 2` (not coerced from a string).
   * Omitted stages use smooth defaults. See `smoothPixelation`.
   */
  pixelation?: PixelationOptions;
}

export type EmojiImageFormat = "image" | "blob" | "dataUrl";

export type EmojiImageSource = EmojiSource | "native";

export interface ResponsiveImageOptions {
  dpr?: number | "auto";
  display?: "fixed" | "css";
  style?: {
    width?: string;
    height?: string;
    objectFit?: "contain" | "cover" | "fill";
  };
}

export type ResponsiveImage = boolean | ResponsiveImageOptions;

export interface EmojiToImageOptions extends Omit<EmojiBaseOptions, "source"> {
  source?: EmojiImageSource;
  /** Draw the system emoji font if `source` and `fallbacks` all fail. Default: false. */
  fallbackToNative?: boolean;
  format?: EmojiImageFormat;
  mimeType?: "image/png" | "image/webp";
  background?: string | null;
  /**
   * @deprecated Removed in v2. Use `pixelation`.
   *
   * `pixelate` is a `number`. `pixelation` is a `PixelationOptions` object.
   * Those are different types and are not merged: when both are set, the object
   * is used as given and this number is not copied into `blockSize` or either stage.
   *
   * Until v2, values `>= 2` are coerced to `{ blockSize: pixelate }` and drawn
   * with smooth defaults (bilinear downscale, nearest upscale, `rounding: "floor"`).
   * Values below 2 mean off, do not warn, and are not coerced. The `>=` check
   * uses JavaScript ToNumber, so a numeric string counts as on. v2 removes
   * this option, that coercion, and that ToNumber check.
   */
  pixelate?: number;
  /**
   * Downscale and upscale settings. Wins over `pixelate` when both are set.
   * `blockSize` must be a finite number `>= 2` (not coerced from a string).
   * Omitted stages use smooth defaults. `{ blockSize: 8 }` matches `pixelate: 8`
   * on an even split. `quality` has no effect while that stage's smoothing is off.
   */
  pixelation?: PixelationOptions;
  /** Font stack used when `source` is `"native"`. */
  fontFamily?: string;
  responsive?: ResponsiveImage;
  /** Logical CSS pixel widths for `<img srcset>` generation. Requires `format: "image"`. */
  srcSet?: number[];
  /** Optional `<img sizes="...">` attribute when `srcSet` is set. */
  sizes?: string;
}

export type EmojiToImageResult<TFormat extends EmojiImageFormat = "image"> = TFormat extends "blob"
  ? Blob
  : TFormat extends "dataUrl"
    ? string
    : HTMLImageElement;
