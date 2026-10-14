import { IncompatibleOptionsError } from "./errors.ts";
import { fetchSvgText } from "./fetchSvg.ts";
import { normalizeSvg } from "./normalizeSvg.ts";
import { coercePixelation } from "./pixelation.ts";
import { resolveResponsiveSvg } from "./responsive.ts";
import { svgToDataUrl } from "./svgToImage.ts";
import type { EmojiToSvgOptions } from "./types.ts";
import { wrapRasterSvg } from "./wrapRasterSvg.ts";

const PIXELATE_RESPONSIVE_MESSAGE =
  "responsive is incompatible with pixelate on emojiToSvg because pixelated output embeds a raster image";
const PIXELATION_RESPONSIVE_MESSAGE =
  "responsive is incompatible with pixelation on emojiToSvg because pixelated output embeds a raster image";

export async function emojiToSvg(emoji: string, options: EmojiToSvgOptions = {}): Promise<string> {
  const {
    size = 72,
    xmlDeclaration,
    pixelate,
    pixelation: pixelationOption,
    responsive,
    ...fetchOptions
  } = options;
  // Coerce before the responsive check. v2 removes `pixelate: number`; pass
  // only the object downstream so svg rasterization does not coerce again.
  const pixelation = coercePixelation({ pixelate, pixelation: pixelationOption });

  if (pixelation !== null && resolveResponsiveSvg(responsive) !== null) {
    throw new IncompatibleOptionsError(
      pixelationOption !== undefined ? PIXELATION_RESPONSIVE_MESSAGE : PIXELATE_RESPONSIVE_MESSAGE,
    );
  }

  const svg = await fetchSvgText({ emoji, ...fetchOptions });

  const normalized = normalizeSvg({
    svg,
    size,
    responsive,
    xmlDeclaration: pixelation !== null ? false : xmlDeclaration,
  });

  if (pixelation !== null) {
    const dataUrl = await svgToDataUrl({
      svg: normalized,
      size,
      pixelation,
    });

    return wrapRasterSvg({
      dataUrl,
      size,
      xmlDeclaration,
    });
  }

  return normalized;
}

export type {
  EmojiToSvgOptions,
  EmojiSource,
  EmojiBaseOptions,
  FluentEmojiSource,
  FluentStyle,
  ResponsiveSvg,
  ResponsiveSvgOptions,
} from "./types.ts";
export type {
  PixelationDownscaleOptions,
  PixelationOptions,
  PixelationRounding,
  PixelationScaleOptions,
  PixelationSmoothingQuality,
} from "./pixelation.ts";
export {
  InvalidEmojiError,
  EmojiNotFoundError,
  EmojiFetchError,
  IncompatibleOptionsError,
} from "./errors.ts";
