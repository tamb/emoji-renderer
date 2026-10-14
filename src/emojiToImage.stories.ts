import type { Meta, StoryObj } from "@storybook/html-vite";
import type { EmojiCdnPreset, EmojiImageFormat, EmojiImageSource } from "./types.ts";
import { emojiToImage } from "./emojiToImage.ts";
import { nearestPixelation, pixelationPresets } from "./pixelation.ts";
import type { PixelationOptions } from "./pixelation.ts";
import {
  formatPixelationDemo,
  pixelationDemoArgs,
  pixelationDemoArgTypes,
  pixelationFromDemoArgs,
} from "./pixelationDemo.ts";
import type { PixelationDemoArgs } from "./pixelationDemo.ts";
import { isEmojiCdnPreset } from "./sources.ts";

interface EmojiToImageStoryArgs {
  emoji: string;
  size: number;
  format: EmojiImageFormat;
  mimeType: "image/png" | "image/webp";
  background: string;
  pixelate: number;
  pixelationPreset: "off" | "smooth" | "nearest";
  pixelationBlockSize: number;
  cache: boolean;
  sourceMode: "native" | "twemoji" | "openmoji" | "noto" | "fluent" | "custom";
  fluentStyle: "color" | "flat" | "high-contrast" | "3d";
  fallbacks: string;
  fallbackToNative: boolean;
  fontFamily: string;
  responsive: boolean;
  srcSet: string;
  sizes: string;
  customBaseUrl: string;
  customExt: string;
  customCodePointFormat: "twemoji" | "openmoji" | "noto";
}

const meta = {
  title: "Emoji/emojiToImage",
  tags: ["autodocs"],
  args: {
    emoji: "😀",
    size: 72,
    format: "image",
    mimeType: "image/png",
    background: "",
    pixelate: 0,
    pixelationPreset: "off",
    pixelationBlockSize: 8,
    cache: true,
    sourceMode: "native",
    fluentStyle: "color",
    fallbacks: "",
    fallbackToNative: false,
    fontFamily: "",
    responsive: false,
    srcSet: "",
    sizes: "(max-width: 600px) 24px, 48px",
    customBaseUrl: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg",
    customExt: ".svg",
    customCodePointFormat: "twemoji",
  },
  argTypes: {
    emoji: {
      control: "text",
      description: "Emoji string to convert, including ZWJ sequences like 👨‍👩‍👧.",
    },
    size: {
      control: { type: "number", min: 16, max: 256, step: 8 },
      description: "Width and height in pixels. Default: 72.",
    },
    format: {
      control: "select",
      options: ["image", "blob", "dataUrl"],
      description:
        'Output type. `"image"` returns an `HTMLImageElement`, `"blob"` a `Blob`, `"dataUrl"` a base64 string. Default: `"image"`.',
    },
    mimeType: {
      control: "select",
      options: ["image/png", "image/webp"],
      description: "Raster MIME type when drawing to canvas. Default: `image/png`.",
    },
    background: {
      control: "color",
      description:
        "Canvas fill color before drawing. Leave empty for transparent. Default: `null`.",
    },
    pixelate: {
      control: { type: "number", min: 0, max: 32, step: 1 },
      description:
        "Deprecated and removed in v2. `pixelate` is a number; v2 accepts only the `pixelation` object. Values `>= 2` are coerced to `{ blockSize }` with smooth defaults (that ToNumber coercion goes away in v2). Values below 2 stay off. Ignored for the draw when a pixelation preset is selected, but still warns.",
    },
    pixelationPreset: {
      control: "select",
      options: ["off", "smooth", "nearest"],
      description:
        "Pixelation preset. `off` leaves `pixelate` in charge. `smooth` and `nearest` build a `pixelation` object and override its `blockSize`.",
    },
    pixelationBlockSize: {
      control: { type: "number", min: 2, max: 32, step: 1 },
      description:
        "Finite `blockSize` applied when a pixelation preset is selected. Must be >= 2. Ignored when the preset is off.",
    },
    cache: {
      control: "boolean",
      description: "Cache fetched SVG text in memory. Default: true.",
    },
    sourceMode: {
      control: "select",
      options: ["native", "twemoji", "openmoji", "noto", "fluent", "custom"],
      description:
        'Asset source. `"twemoji"` (default) and other CDN presets use pinned jsDelivr URLs. `"native"` draws the system emoji font and can clip some glyphs on mobile. `"fluent"` uses Microsoft Fluent Emoji.',
    },
    fluentStyle: {
      control: "select",
      options: ["color", "flat", "high-contrast", "3d"],
      description: 'Fluent artwork style when sourceMode is `fluent`. Default: `"color"`.',
      if: { arg: "sourceMode", eq: "fluent" },
    },
    fallbacks: {
      control: "text",
      description:
        'Comma-separated CDN presets to try after `source` fails, e.g. `"openmoji,noto,fluent"`.',
    },
    fallbackToNative: {
      control: "boolean",
      description: "Draw the system emoji font if CDN sources all fail. Default: false.",
    },
    fontFamily: {
      control: "text",
      description:
        "Custom font stack when sourceMode is `native`. Leave empty for the default emoji stack.",
      if: { arg: "sourceMode", eq: "native" },
    },
    responsive: {
      control: "boolean",
      description: "Retina-sharp rendering with CSS display sizing (`dpr: auto`, `display: css`).",
    },
    srcSet: {
      control: "text",
      description:
        'Comma-separated logical widths for `<img srcset>`, e.g. `"24,48,96"`. Requires format `"image"`.',
    },
    sizes: {
      control: "text",
      description: "Optional `<img sizes>` attribute when srcSet is set.",
      if: { arg: "srcSet", truthy: true },
    },
    customBaseUrl: {
      control: "text",
      description: "Custom CDN base URL when sourceMode is `custom`.",
      if: { arg: "sourceMode", eq: "custom" },
    },
    customExt: {
      control: "text",
      description: 'File extension when sourceMode is `custom`. Default: ".svg".',
      if: { arg: "sourceMode", eq: "custom" },
    },
    customCodePointFormat: {
      control: "select",
      options: ["twemoji", "openmoji", "noto"],
      description: "Filename stem style for custom sources.",
      if: { arg: "sourceMode", eq: "custom" },
    },
  },
  parameters: {
    docs: {
      description: {
        component: `
Fetches CDN SVG artwork (or draws native system emoji), rasterizes via canvas, and returns an image. The function defaults to Twemoji. These stories use \`source: "native"\` unless the story is demonstrating a CDN or Fluent source.

**Native clipping:** \`"native"\` draws the system emoji font onto a square canvas. Some glyphs can look cropped or cut in half — especially on mobile, where Apple Color Emoji and other platform fonts sit outside the typographic box. CDN presets draw fitted, uncropped artwork.

## Usage

\`\`\`ts
import { emojiToImage } from "emoji-renderer/emojiToImage";

const image = await emojiToImage("😀", { source: "native", size: 48 });
document.body.append(image);
\`\`\`

Tree-shakable import from the package root also works:

\`\`\`ts
import { emojiToImage } from "emoji-renderer";

const image = await emojiToImage("🎉", { source: "native" });
\`\`\`

## Examples

**HTMLImageElement**

\`\`\`ts
const image = await emojiToImage("😀", { source: "native", size: 48 });
\`\`\`

**Blob or data URL output**

\`\`\`ts
const blob = await emojiToImage("😀", { source: "native", format: "blob" });
const dataUrl = await emojiToImage("😀", { source: "native", format: "dataUrl" });
\`\`\`

**Responsive — retina-sharp with CSS display size**

\`\`\`ts
const image = await emojiToImage("😀", {
  source: "native",
  size: 48,
  responsive: true, // dpr: auto, display: css
});
document.body.append(image);
\`\`\`

**Explicit responsive options**

\`\`\`ts
const image = await emojiToImage("😀", {
  source: "native",
  size: 32,
  responsive: {
    dpr: 2,
    display: "css",
    style: { width: "1.5em", height: "1.5em", objectFit: "contain" },
  },
});
\`\`\`

**Srcset for responsive layouts**

\`\`\`ts
const image = await emojiToImage("😀", {
  source: "native",
  size: 48,
  srcSet: [24, 48, 96],
  sizes: "(max-width: 600px) 24px, 48px",
  responsive: { dpr: "auto", display: "css" },
});
// image.srcset and image.sizes are set automatically
document.body.append(image);
\`\`\`

**CDN presets**

\`\`\`ts
const twemoji = await emojiToImage("😀", { source: "twemoji", size: 48 });
const openmoji = await emojiToImage("😀", { source: "openmoji", size: 48 });
const noto = await emojiToImage("😀", { source: "noto", size: 48 });
const fluent = await emojiToImage("😀", { source: "fluent", size: 48 });
\`\`\`

**CDN fallbacks and native fallback**

\`\`\`ts
const image = await emojiToImage("👨‍👩‍👧", {
  source: "fluent",
  fallbacks: ["twemoji", "openmoji"],
  fallbackToNative: true,
});
\`\`\`

**Pixelated**

Spread a preset, then set \`blockSize\`. \`pixelationPresets.nearest\` is nearest-neighbor on both draws. \`pixelationPresets.smooth\` is the bilinear shrink. The **Pixelated** story uses this call. **Custom pixelation stages** overrides individual stage fields. **All pixelation options** exposes every field.

\`\`\`ts
import { emojiToImage, pixelationPresets } from "emoji-renderer";

const blockSize = 12;

const image = await emojiToImage("🧟", {
  source: "native",
  size: 96,
  background: "#111111",
  pixelation: {
    ...pixelationPresets.nearest,
    blockSize,
  },
});
document.body.append(image);
\`\`\`

**Options**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| \`size\` | \`number\` | \`72\` | Width and height in pixels |
| \`source\` | \`"native" \\| "twemoji" \\| "openmoji" \\| "noto" \\| "fluent" \\| { preset: "fluent", style? } \\| { baseUrl, ext?, codePointFormat? }\` | \`"twemoji"\` | CDN preset (default Twemoji), Fluent style, custom asset base, or system font |
| \`fallbacks\` | \`("twemoji" \\| "openmoji" \\| "noto" \\| "fluent")[]\` | none | CDN presets to try after \`source\` fails |
| \`fallbackToNative\` | \`boolean\` | \`false\` | Draw the system emoji font if CDN sources all fail |
| \`fetch\` | \`typeof fetch\` | \`globalThis.fetch\` | Custom fetch (not exposed here) |
| \`timeout\` | \`number\` | \`8000\` | Per-request fetch timeout in milliseconds, composed with \`signal\` (not exposed here) |
| \`retries\` | \`number\` | \`2\` | Same-source retries for transient failures: network, HTTP 429, 5xx (not exposed here) |
| \`cache\` | \`boolean\` | \`true\` | Cache fetched SVG text |
| \`signal\` | \`AbortSignal\` | — | Abort in-flight fetch (not exposed here) |
| \`format\` | \`"image" \\| "blob" \\| "dataUrl"\` | \`"image"\` | Return type. \`"image"\` is an \`HTMLImageElement\`, \`"blob"\` a \`Blob\`, \`"dataUrl"\` a string |
| \`mimeType\` | \`"image/png" \\| "image/webp"\` | \`"image/png"\` | Output MIME type |
| \`background\` | \`string \\| null\` | \`null\` | Canvas fill before drawing. Also the fallback for an omitted stage \`background\` |
| \`pixelate\` | \`number\` | off | Deprecated, removed in v2. A \`number\`, not a \`PixelationOptions\` object. See **PixelationOptions** |
| \`pixelation\` | \`PixelationOptions\` | off | See **PixelationOptions** below. Used as given when \`pixelate\` is also set |
| \`fontFamily\` | \`string\` | emoji stack | Font stack when \`source\` is \`"native"\` |
| \`responsive\` | \`boolean \\| ResponsiveImageOptions\` | off | Retina rendering and CSS display sizing. See **responsive** below |
| \`srcSet\` | \`number[]\` | off | Logical widths for \`<img srcset>\`. Requires \`format: "image"\` |
| \`sizes\` | \`string\` | — | Optional \`<img sizes>\` attribute when \`srcSet\` is set |

### \`source\`

| Shape | Fields |
| --- | --- |
| \`"twemoji" \\| "openmoji" \\| "noto" \\| "fluent"\` | CDN preset. Default \`"twemoji"\` |
| \`"native"\` | System emoji font. \`emojiToImage\` only |
| \`{ preset: "fluent", style?, baseUrl? }\` | \`style\`: \`"flat" \\| "color" \\| "high-contrast" \\| "3d"\` (default \`"color"\`). \`"3d"\` fetches PNG and wraps it in SVG. \`baseUrl\` overrides the pinned Fluent assets root |
| \`{ baseUrl, ext?, codePointFormat? }\` | \`ext\` defaults to \`".svg"\`. \`codePointFormat\`: \`"twemoji" \\| "openmoji" \\| "noto"\` (default \`"twemoji"\`) |

\`fallbacks\` accepts the CDN presets only. Duplicates of \`source\` are skipped.

### \`responsive\`

\`ResponsiveImageOptions\`:

| Field | Type | \`responsive: true\` |
| --- | --- | --- |
| \`dpr\` | \`number \\| "auto"\` | Device pixel ratio |
| \`display\` | \`"fixed" \\| "css"\` | \`"css"\` |
| \`style.width\` | \`string\` | logical size in px |
| \`style.height\` | \`string\` | logical size in px |
| \`style.objectFit\` | \`"contain" \\| "cover" \\| "fill"\` | omitted |

Off means \`dpr: 1\` and \`display: "fixed"\`. An object defaults \`dpr\` to \`"auto"\` and \`display\` to \`"css"\`.

## PixelationOptions

Open **Pixelated** to spread \`pixelationPresets.nearest\` or \`pixelationPresets.smooth\` and set \`blockSize\`. Open **Custom pixelation stages** to override individual stage fields. Open **All pixelation options** to set every field. Each control there is named \`pixelation.blockSize\`, \`pixelation.downscale.[field]\`, or \`pixelation.upscale.[field]\`.

This is the whole object. Comments are the type references.

\`\`\`ts
import type {
  PixelationDownscaleOptions,
  PixelationOptions,
  PixelationRounding,
  PixelationScaleOptions,
  PixelationSmoothingQuality,
} from "emoji-renderer";

const pixelation = {
  blockSize: 8, // number — pixelation.blockSize. Finite, >= 2
  downscale: {
    smoothing: true, // boolean — pixelation.downscale.smoothing. Default true
    quality: "low" as PixelationSmoothingQuality, // "low" | "medium" | "high" — pixelation.downscale.quality
    rounding: "floor" as PixelationRounding, // "floor" | "round" — pixelation.downscale.rounding
    background: null, // string | null — pixelation.downscale.background
  } satisfies PixelationDownscaleOptions,
  upscale: {
    smoothing: false, // boolean — pixelation.upscale.smoothing. Default false
    quality: "low" as PixelationSmoothingQuality, // pixelation.upscale.quality
    background: "#1a1a2e", // string | null — pixelation.upscale.background
  } satisfies PixelationScaleOptions,
} satisfies PixelationOptions;
\`\`\`

\`pixelation.blockSize\` must be a finite \`number\` \`>= 2\`. Any other value throws \`IncompatibleOptionsError\` (\`pixelation.blockSize must be a finite number >= 2\`). \`{ blockSize: 8 }\` with both stages omitted matches \`pixelate: 8\` on an even split: downscale smoothing on, \`quality: "low"\`, \`rounding: "floor"\`; upscale smoothing off, \`quality: "low"\`. Cell count is \`max(1, rounding(size / blockSize))\`, then that canvas is stretched to \`size\`.

\`pixelation.downscale.quality\` and \`pixelation.upscale.quality\` are \`PixelationSmoothingQuality\`. \`"low"\` is bilinear. Canvas ignores \`quality\` while that stage's \`smoothing\` is false, and still stores the value. \`pixelation.downscale.rounding\` is the only \`PixelationRounding\` field.

Omit \`pixelation.downscale.background\` or \`pixelation.upscale.background\` to use the top-level \`background\`. \`null\` stays transparent. That omit-versus-null rule stays in v2. With \`source: "native"\`, the glyph canvas stays transparent and these stage backgrounds are the only fills.

\`pixelate\` is a \`number\` and is removed in v2. It is not copied into \`blockSize\` or either stage. Below 2 it stays off. \`>= 2\` warns once, then becomes \`{ blockSize: pixelate }\` only when \`pixelation\` is omitted. The \`>=\` check uses JavaScript ToNumber. The warning is: \`pixelate is deprecated and will be removed in a future major version. Use pixelation: { blockSize: N } or smoothPixelation instead.\`

\`\`\`ts
const smoothPixelation = {
  blockSize: 8,
  downscale: { smoothing: true, quality: "low", rounding: "floor" },
  upscale: { smoothing: false, quality: "low" },
} satisfies PixelationOptions;

const nearestPixelation = {
  blockSize: 8,
  downscale: { smoothing: false, quality: "low", rounding: "round" },
  upscale: { smoothing: false, quality: "low" },
} satisfies PixelationOptions;

const pixelationPresets = {
  smooth: smoothPixelation,
  nearest: nearestPixelation,
};
\`\`\`

## Errors

| Error | When |
| --- | --- |
| \`InvalidEmojiError\` | Empty or invalid emoji input |
| \`EmojiNotFoundError\` | Asset missing (HTTP 404/410, unmapped Fluent glyph) |
| \`EmojiFetchError\` | Transient fetch failure after \`retries\` (network, HTTP 429/5xx, timeout) |
| \`IncompatibleOptionsError\` | \`pixelation.blockSize must be a finite number >= 2\`, or \`srcSet requires format: "image"\` |
| \`RasterizeError\` | Canvas or image rasterization failed |

\`EmojiNotFoundError\` and \`EmojiFetchError\` try \`fallbacks\` when those are set. An aborted \`signal\` does not.
        `,
      },
    },
  },
} satisfies Meta<EmojiToImageStoryArgs>;

export default meta;
type Story = StoryObj<EmojiToImageStoryArgs>;

function resolveSource(args: EmojiToImageStoryArgs): EmojiImageSource {
  if (args.sourceMode === "custom") {
    return {
      baseUrl: args.customBaseUrl,
      ext: args.customExt || ".svg",
      codePointFormat: args.customCodePointFormat,
    };
  }
  if (args.sourceMode === "fluent") {
    return args.fluentStyle === "color" ? "fluent" : { preset: "fluent", style: args.fluentStyle };
  }
  return args.sourceMode;
}

function parseFallbacks(value: string): EmojiCdnPreset[] | undefined {
  const sources = value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is EmojiCdnPreset => isEmojiCdnPreset(part));

  return sources.length > 0 ? sources : undefined;
}

function parseSrcSet(value: string): number[] | undefined {
  const widths = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((width) => Number.isFinite(width) && width > 0);

  return widths.length > 0 ? widths : undefined;
}

function storyPixelation(args: EmojiToImageStoryArgs): PixelationOptions | undefined {
  if (args.pixelationPreset === "smooth" || args.pixelationPreset === "nearest") {
    return {
      ...pixelationPresets[args.pixelationPreset],
      blockSize: args.pixelationBlockSize,
    };
  }
  return undefined;
}

function renderImagePreviewWith(
  args: EmojiToImageStoryArgs,
  pixelationOverride?: PixelationOptions,
): HTMLDivElement {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "12px";
  root.style.fontFamily = "system-ui, sans-serif";
  root.style.maxWidth = "32rem";

  const status = document.createElement("p");
  status.textContent = "Loading…";
  status.style.margin = "0";
  status.style.color = "#666";

  const preview = document.createElement("div");
  preview.style.display = "flex";
  preview.style.alignItems = "center";
  preview.style.gap = "16px";

  const details = document.createElement("pre");
  details.style.margin = "0";
  details.style.padding = "12px";
  details.style.borderRadius = "8px";
  details.style.background = "color-mix(in srgb, CanvasText 8%, Canvas)";
  details.style.fontSize = "12px";
  details.style.whiteSpace = "pre-wrap";
  details.style.wordBreak = "break-word";

  root.append(status, preview, details);

  const pixelation = pixelationOverride ?? storyPixelation(args);

  if (pixelationOverride) {
    root.style.maxWidth = "48rem";
    const objectView = document.createElement("pre");
    objectView.style.margin = "0";
    objectView.style.padding = "12px";
    objectView.style.borderRadius = "8px";
    objectView.style.background = "color-mix(in srgb, CanvasText 8%, Canvas)";
    objectView.style.fontSize = "12px";
    objectView.style.whiteSpace = "pre-wrap";
    objectView.textContent = formatPixelationDemo(pixelationOverride);
    root.append(objectView);
  }

  void emojiToImage(args.emoji, {
    size: args.size,
    format: args.format,
    mimeType: args.mimeType,
    background: args.background || null,
    pixelate: pixelationOverride === undefined && args.pixelate >= 2 ? args.pixelate : undefined,
    pixelation,
    cache: args.cache,
    source: resolveSource(args),
    fallbacks: parseFallbacks(args.fallbacks),
    fallbackToNative: args.fallbackToNative || undefined,
    fontFamily: args.fontFamily || undefined,
    responsive: args.responsive || undefined,
    srcSet: parseSrcSet(args.srcSet),
    sizes: args.srcSet ? args.sizes : undefined,
  })
    .then((result) => {
      status.textContent = `${args.emoji} · ${args.size}px · format=${args.format}`;

      if (args.format === "image" && result instanceof HTMLImageElement) {
        if (!args.responsive && !args.srcSet) {
          result.style.width = `${args.size}px`;
          result.style.height = `${args.size}px`;
        }
        preview.replaceChildren(result);
        details.textContent = [
          `HTMLImageElement ${result.width}×${result.height}`,
          result.srcset ? `srcset=${result.srcset}` : "",
          result.sizes ? `sizes=${result.sizes}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return;
      }

      if (args.format === "blob" && result instanceof Blob) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(result);
        img.style.width = `${args.size}px`;
        img.style.height = `${args.size}px`;
        img.onload = () => URL.revokeObjectURL(img.src);
        preview.replaceChildren(img);
        details.textContent = `Blob type=${result.type} size=${result.size} bytes`;
        return;
      }

      if (args.format === "dataUrl" && typeof result === "string") {
        const img = document.createElement("img");
        img.src = result;
        img.style.width = `${args.size}px`;
        img.style.height = `${args.size}px`;
        preview.replaceChildren(img);
        details.textContent = result.slice(0, 120) + (result.length > 120 ? "…" : "");
      }
    })
    .catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : "Failed to render image";
      preview.replaceChildren();
      details.textContent = "";
    });

  return root;
}

function renderImagePreview(args: EmojiToImageStoryArgs): HTMLDivElement {
  return renderImagePreviewWith(args);
}

export const Default: Story = {
  render: renderImagePreview,
};

export const BlobOutput: Story = {
  name: "Blob output",
  args: {
    emoji: "🎉",
    format: "blob",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const blob = await emojiToImage("🎉", { source: "native", format: "blob" });
// blob.type === "image/png"
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const DataUrlOutput: Story = {
  name: "Data URL output",
  args: {
    emoji: "🌈",
    format: "dataUrl",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const dataUrl = await emojiToImage("🌈", { source: "native", format: "dataUrl" });
img.src = dataUrl;
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const WebpMimeType: Story = {
  name: "WebP MIME type",
  args: {
    emoji: "🔥",
    mimeType: "image/webp",
    format: "blob",
  },
  render: renderImagePreview,
};

export const Pixelated: Story = {
  name: "Pixelated",
  args: {
    emoji: "🧟",
    size: 96,
    pixelate: 0,
    pixelationPreset: "nearest",
    pixelationBlockSize: 12,
    background: "#111111",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`pixelationPreset\` chooses \`pixelationPresets.nearest\` or \`pixelationPresets.smooth\`. \`pixelationBlockSize\` replaces that preset's \`blockSize\` and must be \`>= 2\`. It is ignored while the preset is \`off\`.

\`\`\`ts
import { emojiToImage, pixelationPresets } from "emoji-renderer";

const blockSize = 12;

const image = await emojiToImage("🧟", {
  source: "native",
  size: 96,
  background: "#111111",
  pixelation: {
    ...pixelationPresets.nearest,
    blockSize,
  },
});
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const CustomPixelationStages: Story = {
  name: "Custom pixelation stages",
  args: {
    emoji: "🧟",
    size: 96,
    background: "#ffffff",
    pixelate: 0,
    pixelationPreset: "off",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`quality\` has no effect while that stage's \`smoothing\` is off. An explicit stage \`background: null\` stays transparent even when the top-level background is set. \`pixelation\` wins when \`pixelate\` is also passed.

\`\`\`ts
import { emojiToImage, nearestPixelation } from "emoji-renderer";

await emojiToImage("🧟", {
  source: "native",
  size: 96,
  background: "#fff",
  pixelation: {
    ...nearestPixelation,
    blockSize: 6,
    downscale: { ...nearestPixelation.downscale, background: null },
    upscale: { smoothing: true, quality: "high" },
  },
});
\`\`\`
        `,
      },
    },
  },
  render: (args) =>
    renderImagePreviewWith(args, {
      ...nearestPixelation,
      blockSize: 6,
      downscale: { ...nearestPixelation.downscale, background: null },
      upscale: { smoothing: true, quality: "high" },
    }),
};

export const AllPixelationOptions: StoryObj<EmojiToImageStoryArgs & PixelationDemoArgs> = {
  name: "All pixelation options",
  args: {
    emoji: "🧟",
    size: 96,
    background: "#ffffff",
    pixelate: 0,
    pixelationPreset: "off",
    ...pixelationDemoArgs,
    "pixelation.downscale.quality": "high",
    "pixelation.downscale.rounding": "round",
    "pixelation.downscale.background": "omit",
    "pixelation.upscale.quality": "high",
    "pixelation.upscale.background": "omit",
  },
  argTypes: pixelationDemoArgTypes,
  parameters: {
    docs: {
      description: {
        story:
          "Every `pixelation` field is a control. `omit` drops that stage `background` from the object.",
      },
    },
  },
  render: (args) => renderImagePreviewWith(args, pixelationFromDemoArgs(args)),
};

export const CustomBackground: Story = {
  name: "Custom background",
  args: {
    emoji: "🌈",
    size: 96,
    background: "#111827",
  },
  render: renderImagePreview,
};

export const CdnFallbacks: Story = {
  name: "CDN fallbacks",
  args: {
    emoji: "👨‍👩‍👧",
    size: 96,
    sourceMode: "fluent",
    fallbacks: "twemoji,openmoji",
    fallbackToNative: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
Fluent has no asset for 👨‍👩‍👧. \`fallbacks\` tries other CDNs; \`fallbackToNative\` uses the system font if those fail too.

\`\`\`ts
const image = await emojiToImage("👨‍👩‍👧", {
  source: "fluent",
  fallbacks: ["twemoji", "openmoji"],
  fallbackToNative: true,
});
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const FluentSource: Story = {
  name: "Fluent emoji",
  args: {
    emoji: "😀",
    size: 96,
    sourceMode: "fluent",
    fluentStyle: "color",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const image = await emojiToImage("😀", {
  source: "fluent",
  size: 96,
});
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const ResponsiveImage: Story = {
  name: "Responsive image",
  args: {
    emoji: "😀",
    size: 48,
    responsive: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const image = await emojiToImage("😀", {
  source: "native",
  size: 48,
  responsive: true,
});
document.body.append(image);
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const SrcSetImage: Story = {
  name: "Srcset image",
  args: {
    emoji: "🎉",
    size: 48,
    responsive: true,
    srcSet: "24,48,96",
    sizes: "(max-width: 600px) 24px, 48px",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const image = await emojiToImage("🎉", {
  size: 48,
  srcSet: [24, 48, 96],
  sizes: "(max-width: 600px) 24px, 48px",
  responsive: true,
});
document.body.append(image);
\`\`\`
        `,
      },
    },
  },
  render: renderImagePreview,
};

export const SideBySideComparison: Story = {
  name: "SVG vs image",
  render: (args) => {
    const root = document.createElement("div");
    root.style.display = "grid";
    root.style.gap = "12px";
    root.style.fontFamily = "system-ui, sans-serif";

    const status = document.createElement("p");
    status.textContent = "Loading…";
    status.style.margin = "0";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "24px";

    root.append(status, row);

    void Promise.all([
      import("./emojiToSvg.ts").then(({ emojiToSvg }) =>
        emojiToSvg(args.emoji, {
          size: args.size,
          cache: args.cache,
        }),
      ),
      emojiToImage(args.emoji, {
        size: args.size,
        background: args.background || null,
        cache: args.cache,
        source: resolveSource(args),
        fontFamily: args.fontFamily || undefined,
      }),
    ])
      .then(([svg, image]) => {
        status.textContent = `${args.emoji} · ${args.size}px`;

        const svgWrap = document.createElement("div");
        svgWrap.innerHTML = svg;

        if (image instanceof HTMLImageElement) {
          image.style.width = `${args.size}px`;
          image.style.height = `${args.size}px`;
        }

        row.replaceChildren(svgWrap, image);
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : "Failed to render";
      });

    return root;
  },
};
