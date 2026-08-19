import { IncompatibleOptionsError } from "./errors.ts";
import { nativeEmojiToDataUrl, nativeEmojiToImageBlob } from "./nativeToImage.ts";
import { emojiToSvg } from "./emojiToSvg.ts";
import {
  applyImageDisplay,
  normalizeSrcSetWidths,
  resolveDefaultSrcWidth,
  resolveRenderSize,
  resolveResponsiveImage,
} from "./responsive.ts";
import { DEFAULT_IMAGE_SOURCE } from "./sources.ts";
import { blobToDataUrl, loadImageFromUrl, svgToDataUrl, svgToImageBlob } from "./svgToImage.ts";
import type {
  EmojiImageFormat,
  EmojiImageSource,
  EmojiSource,
  EmojiToImageOptions,
  EmojiToImageResult,
} from "./types.ts";

interface RenderEmojiBlobOptions {
  emoji: string;
  renderSize: number;
  mimeType: "image/png" | "image/webp";
  background: string | null;
  pixelate?: number;
  source: EmojiImageSource;
  fontFamily?: string;
  fetch?: typeof fetch;
  cache?: boolean;
  signal?: AbortSignal;
}

function isNativeSource(source: EmojiImageSource): source is "native" {
  return source === "native";
}

function asCdnSource(source: EmojiImageSource): EmojiSource {
  return source as EmojiSource;
}

async function renderEmojiBlob(options: RenderEmojiBlobOptions): Promise<Blob> {
  const {
    emoji,
    renderSize,
    mimeType,
    background,
    pixelate,
    source,
    fontFamily,
    fetch,
    cache,
    signal,
  } = options;

  if (isNativeSource(source)) {
    return nativeEmojiToImageBlob({
      emoji,
      size: renderSize,
      mimeType,
      background,
      pixelate,
      fontFamily,
    });
  }

  const svg = await emojiToSvg(emoji, {
    size: renderSize,
    source: asCdnSource(source),
    fetch,
    cache,
    signal,
  });

  return svgToImageBlob({
    svg,
    size: renderSize,
    mimeType,
    background,
    pixelate,
  });
}

async function blobToHtmlImage(blob: Blob, renderSize: number): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageFromUrl(objectUrl);
    image.width = renderSize;
    image.height = renderSize;
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function renderEmojiImageElement(
  emoji: string,
  logicalSize: number,
  options: EmojiToImageOptions,
): Promise<HTMLImageElement> {
  const {
    mimeType = "image/png",
    background = null,
    pixelate,
    source = DEFAULT_IMAGE_SOURCE,
    fontFamily,
    responsive,
    srcSet,
    sizes,
    fetch,
    cache,
    signal,
  } = options;

  const resolved = resolveResponsiveImage(responsive, logicalSize);

  if (srcSet && srcSet.length > 0) {
    const widths = normalizeSrcSetWidths(srcSet, logicalSize);
    const defaultWidth = resolveDefaultSrcWidth(widths, logicalSize);
    const defaultResolved = resolveResponsiveImage(responsive, defaultWidth);
    const variants: Array<{ physicalWidth: number; url: string }> = [];

    for (const width of widths) {
      const renderSize = resolveRenderSize(width, defaultResolved.dpr);
      const blob = await renderEmojiBlob({
        emoji,
        renderSize,
        mimeType,
        background,
        pixelate,
        source,
        fontFamily,
        fetch,
        cache,
        signal,
      });
      variants.push({
        physicalWidth: renderSize,
        url: await blobToDataUrl(blob),
      });
    }

    const defaultVariant =
      variants.find((_variant, index) => widths[index] === defaultWidth) ??
      variants[variants.length - 1]!;

    const image = await loadImageFromUrl(defaultVariant.url);
    image.src = defaultVariant.url;
    image.srcset = variants.map((variant) => `${variant.url} ${variant.physicalWidth}w`).join(", ");

    if (sizes) {
      image.sizes = sizes;
    }

    applyImageDisplay(image, defaultWidth, defaultResolved);
    return image;
  }

  const renderSize = resolveRenderSize(logicalSize, resolved.dpr);
  const blob = await renderEmojiBlob({
    emoji,
    renderSize,
    mimeType,
    background,
    pixelate,
    source,
    fontFamily,
    fetch,
    cache,
    signal,
  });

  const image = await blobToHtmlImage(blob, renderSize);
  applyImageDisplay(image, logicalSize, resolved);
  return image;
}

export async function emojiToImage<TFormat extends EmojiImageFormat = "image">(
  emoji: string,
  options: EmojiToImageOptions & { format?: TFormat } = {},
): Promise<EmojiToImageResult<TFormat>> {
  const {
    format = "image" as TFormat,
    mimeType = "image/png",
    background = null,
    pixelate,
    size = 72,
    source = DEFAULT_IMAGE_SOURCE,
    fontFamily,
    responsive,
    srcSet,
    sizes,
    fetch,
    cache,
    signal,
  } = options;

  if (srcSet && srcSet.length > 0 && format !== "image") {
    throw new IncompatibleOptionsError('srcSet requires format: "image"');
  }

  if (format === "image") {
    return (await renderEmojiImageElement(emoji, size, {
      mimeType,
      background,
      pixelate,
      source,
      fontFamily,
      responsive,
      srcSet,
      sizes,
      fetch,
      cache,
      signal,
    })) as EmojiToImageResult<TFormat>;
  }

  const resolved = resolveResponsiveImage(responsive, size);
  const renderSize = resolveRenderSize(size, resolved.dpr);

  if (isNativeSource(source)) {
    const nativeOptions = {
      emoji,
      size: renderSize,
      mimeType,
      background,
      pixelate,
      fontFamily,
    };

    if (format === "blob") {
      return (await nativeEmojiToImageBlob(nativeOptions)) as EmojiToImageResult<TFormat>;
    }

    return (await nativeEmojiToDataUrl(nativeOptions)) as EmojiToImageResult<TFormat>;
  }

  const svg = await emojiToSvg(emoji, {
    size: renderSize,
    source: asCdnSource(source),
    fetch,
    cache,
    signal,
  });

  const rasterOptions = { svg, size: renderSize, mimeType, background, pixelate };

  if (format === "blob") {
    return (await svgToImageBlob(rasterOptions)) as EmojiToImageResult<TFormat>;
  }

  return (await svgToDataUrl(rasterOptions)) as EmojiToImageResult<TFormat>;
}

export type {
  EmojiToImageOptions,
  EmojiImageFormat,
  EmojiImageSource,
  EmojiToImageResult,
  EmojiSource,
  EmojiBaseOptions,
  ResponsiveImage,
  ResponsiveImageOptions,
} from "./types.ts";
export {
  InvalidEmojiError,
  EmojiNotFoundError,
  RasterizeError,
  IncompatibleOptionsError,
} from "./errors.ts";
