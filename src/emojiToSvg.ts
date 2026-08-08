import { IncompatibleOptionsError } from "./errors.ts";
import { fetchSvgText } from "./fetchSvg.ts";
import { normalizeSvg } from "./normalizeSvg.ts";
import { resolveResponsiveSvg } from "./responsive.ts";
import { svgToDataUrl } from "./svgToImage.ts";
import type { EmojiToSvgOptions } from "./types.ts";
import { wrapRasterSvg } from "./wrapRasterSvg.ts";

export async function emojiToSvg(emoji: string, options: EmojiToSvgOptions = {}): Promise<string> {
  const { size = 72, xmlDeclaration, pixelate, responsive, ...fetchOptions } = options;

  if (pixelate !== undefined && pixelate >= 2 && resolveResponsiveSvg(responsive) !== null) {
    throw new IncompatibleOptionsError(
      "responsive is incompatible with pixelate on emojiToSvg because pixelated output embeds a raster image",
    );
  }

  const svg = await fetchSvgText({ emoji, ...fetchOptions });

  const normalized = normalizeSvg({
    svg,
    size,
    responsive,
    xmlDeclaration: pixelate && pixelate >= 2 ? false : xmlDeclaration,
  });

  if (pixelate !== undefined && pixelate >= 2) {
    const dataUrl = await svgToDataUrl({
      svg: normalized,
      size,
      pixelate,
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
  ResponsiveSvg,
  ResponsiveSvgOptions,
} from "./types.ts";
export { InvalidEmojiError, EmojiNotFoundError, IncompatibleOptionsError } from "./errors.ts";
