export type CodePointFormat = "twemoji" | "openmoji" | "noto";

export type EmojiCdnPreset = "twemoji" | "openmoji" | "noto";

export type EmojiSource =
  | EmojiCdnPreset
  | {
      baseUrl: string;
      ext?: string;
      /** Filename stem style derived from the Twemoji-style codepoint. Default: `"twemoji"`. */
      codePointFormat?: CodePointFormat;
    };

export interface EmojiBaseOptions {
  source?: EmojiSource;
  size?: number;
  fetch?: typeof fetch;
  cache?: boolean;
  signal?: AbortSignal;
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
   * Block size in output pixels. Values >= 2 rasterize the emoji and embed the
   * pixelated PNG inside an SVG wrapper (Twemoji paths are vector and cannot be
   * pixelated directly).
   */
  pixelate?: number;
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
  format?: EmojiImageFormat;
  mimeType?: "image/png" | "image/webp";
  background?: string | null;
  /** Block size in output pixels. Values >= 2 produce a pixel-art look. Default: off. */
  pixelate?: number;
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
