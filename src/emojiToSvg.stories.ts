import type { Meta, StoryObj } from "@storybook/html-vite";
import type { EmojiCdnPreset, EmojiSource } from "./types.ts";
import { emojiToSvg } from "./emojiToSvg.ts";
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

interface EmojiToSvgStoryArgs {
  emoji: string;
  size: number;
  xmlDeclaration: boolean;
  pixelate: number;
  pixelationPreset: "off" | "smooth" | "nearest";
  pixelationBlockSize: number;
  cache: boolean;
  sourceMode: "twemoji" | "openmoji" | "noto" | "fluent" | "custom";
  fluentStyle: "color" | "flat" | "high-contrast" | "3d";
  fallbacks: string;
  responsiveMode: "fixed" | "intrinsic" | "relative" | "fill";
  customBaseUrl: string;
  customExt: string;
  customCodePointFormat: "twemoji" | "openmoji" | "noto";
}

const meta = {
  title: "Emoji/emojiToSvg",
  tags: ["autodocs"],
  args: {
    emoji: "😀",
    size: 72,
    xmlDeclaration: false,
    pixelate: 0,
    pixelationPreset: "off",
    pixelationBlockSize: 8,
    cache: true,
    sourceMode: "twemoji",
    fluentStyle: "color",
    fallbacks: "",
    responsiveMode: "fixed",
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
      description: "Width and height applied to the SVG element. Default: 72.",
    },
    xmlDeclaration: {
      control: "boolean",
      description: 'Prefix the SVG with `<?xml version="1.0" encoding="UTF-8"?>`. Default: false.',
    },
    pixelate: {
      control: { type: "number", min: 0, max: 32, step: 1 },
      description:
        "Deprecated and removed in v2. `pixelate` is a number coerced to `{ blockSize }` when `>= 2` (that coercion and its ToNumber check go away in v2). Values below 2 stay off. Incompatible with responsive. A selected pixelation preset wins.",
    },
    pixelationPreset: {
      control: "select",
      options: ["off", "smooth", "nearest"],
      description:
        "Pixelation preset. `off` leaves `pixelate` in charge. `smooth` and `nearest` build a `pixelation` object and override its `blockSize`. Incompatible with responsive.",
    },
    pixelationBlockSize: {
      control: { type: "number", min: 2, max: 32, step: 1 },
      description:
        "Finite `blockSize` applied when a pixelation preset is selected. Must be >= 2. Ignored when the preset is off.",
    },
    responsiveMode: {
      control: "select",
      options: ["fixed", "intrinsic", "relative", "fill"],
      description:
        'Responsive layout. `"intrinsic"` omits pixel dimensions; `"relative"` uses `1.2em`; `"fill"` uses `100%`.',
    },
    cache: {
      control: "boolean",
      description: "Cache fetched SVG text in memory. Default: true.",
    },
    sourceMode: {
      control: "select",
      options: ["twemoji", "openmoji", "noto", "fluent", "custom"],
      description:
        'Asset source. CDN presets use pinned jsDelivr URLs. `"fluent"` uses Microsoft Fluent Emoji. `"custom"` uses baseUrl + optional codePointFormat.',
    },
    fluentStyle: {
      control: "select",
      options: ["color", "flat", "high-contrast", "3d"],
      description:
        'Fluent artwork style when sourceMode is `fluent`. Default: `"color"`. `"3d"` embeds a PNG in SVG.',
      if: { arg: "sourceMode", eq: "fluent" },
    },
    fallbacks: {
      control: "text",
      description:
        'Comma-separated CDN presets to try after `source` fails, e.g. `"openmoji,noto,fluent"`.',
    },
    customBaseUrl: {
      control: "text",
      description: "Custom CDN base URL when sourceMode is `custom`. Trailing slashes are trimmed.",
      if: { arg: "sourceMode", eq: "custom" },
    },
    customExt: {
      control: "text",
      description:
        'File extension appended to the codepoint when sourceMode is `custom`. Default: ".svg".',
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
Fetches CDN SVG artwork for an emoji and returns inline SVG markup. Defaults to Twemoji; OpenMoji, Noto, and Fluent presets are also available.

## Usage

\`\`\`ts
import { emojiToSvg } from "emoji-renderer/emojiToSvg";

const svg = await emojiToSvg("😀", { size: 48 });
document.querySelector("#target")!.innerHTML = svg;
\`\`\`

Tree-shakable import from the package root also works:

\`\`\`ts
import { emojiToSvg } from "emoji-renderer";

const svg = await emojiToSvg("🎉");
\`\`\`

## Examples

**Fixed size (default)**

\`\`\`ts
const svg = await emojiToSvg("😀", { size: 72 });
\`\`\`

**Responsive — CSS controls size (vector scaling)**

\`\`\`ts
const svg = await emojiToSvg("😀", { responsive: true });
// CSS: .emoji svg { width: clamp(1rem, 4vw, 2.5rem); height: auto; }
\`\`\`

**Text-sized with \`em\` units**

\`\`\`ts
const svg = await emojiToSvg("😀", {
  responsive: { mode: "relative", width: "1.2em", height: "1.2em" },
});
\`\`\`

**Fill a container**

\`\`\`ts
const svg = await emojiToSvg("🌈", {
  responsive: { mode: "fill", width: "100%", height: "100%" },
});
\`\`\`

**Pixelated**

Spread a preset, then set \`blockSize\`. \`pixelationPresets.nearest\` is nearest-neighbor on both draws. \`pixelationPresets.smooth\` is the bilinear shrink. The **Pixelated** story uses this call. **Custom pixelation stages** overrides individual stage fields. **All pixelation options** exposes every field. \`emojiToSvg\` has no native source, so this uses the CDN artwork and returns an SVG wrapper around a pixelated PNG. \`responsive\` with pixelation throws \`IncompatibleOptionsError\`.

\`\`\`ts
import { emojiToSvg, pixelationPresets } from "emoji-renderer";

const blockSize = 12;

const svg = await emojiToSvg("🧟", {
  size: 96,
  pixelation: {
    ...pixelationPresets.nearest,
    blockSize,
  },
});
document.querySelector("#target")!.innerHTML = svg;
\`\`\`

**OpenMoji / Noto / Fluent presets**

\`\`\`ts
const openmoji = await emojiToSvg("😀", { source: "openmoji" });
const noto = await emojiToSvg("😀", { source: "noto" });
const fluent = await emojiToSvg("😀", { source: "fluent" });
const fluentFlat = await emojiToSvg("😀", { source: { preset: "fluent", style: "flat" } });
\`\`\`

**CDN fallbacks**

\`\`\`ts
const svg = await emojiToSvg("👨‍👩‍👧", {
  source: "fluent",
  fallbacks: ["twemoji", "openmoji"],
});
\`\`\`

**Custom CDN source**

\`\`\`ts
const svg = await emojiToSvg("😀", {
  source: {
    baseUrl: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg",
    ext: ".svg",
    codePointFormat: "twemoji",
  },
});
\`\`\`

**Options**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| \`size\` | \`number\` | \`72\` | Width and height in pixels |
| \`source\` | \`"twemoji" \\| "openmoji" \\| "noto" \\| "fluent" \\| { preset: "fluent", style? } \\| { baseUrl, ext?, codePointFormat? }\` | \`"twemoji"\` | CDN preset, Fluent style, or custom asset base |
| \`fallbacks\` | \`("twemoji" \\| "openmoji" \\| "noto" \\| "fluent")[]\` | none | CDN presets to try after \`source\` fails |
| \`fetch\` | \`typeof fetch\` | \`globalThis.fetch\` | Custom fetch (not exposed here) |
| \`timeout\` | \`number\` | \`8000\` | Per-request fetch timeout in milliseconds, composed with \`signal\` (not exposed here) |
| \`retries\` | \`number\` | \`2\` | Same-source retries for transient failures: network, HTTP 429, 5xx (not exposed here) |
| \`cache\` | \`boolean\` | \`true\` | Cache fetched SVG text |
| \`signal\` | \`AbortSignal\` | — | Abort in-flight fetch (not exposed here) |
| \`xmlDeclaration\` | \`boolean\` | \`false\` | Include \`<?xml ...?>\` on the returned markup. Active pixelation still honors this on the wrapper; the inner SVG is written without it |
| \`pixelate\` | \`number\` | off | Deprecated, removed in v2. A \`number\`, not a \`PixelationOptions\` object. See **PixelationOptions** |
| \`pixelation\` | \`PixelationOptions\` | off | See **PixelationOptions** below. Used as given when \`pixelate\` is also set. Incompatible with \`responsive\` |
| \`responsive\` | \`boolean \\| ResponsiveSvgOptions\` | off | CSS-scalable SVG. See **responsive** below. Incompatible with active pixelation |

### \`source\`

| Shape | Fields |
| --- | --- |
| \`"twemoji" \\| "openmoji" \\| "noto" \\| "fluent"\` | CDN preset. Default \`"twemoji"\` |
| \`{ preset: "fluent", style?, baseUrl? }\` | \`style\`: \`"flat" \\| "color" \\| "high-contrast" \\| "3d"\` (default \`"color"\`). \`"3d"\` fetches PNG and wraps it in SVG. \`baseUrl\` overrides the pinned Fluent assets root |
| \`{ baseUrl, ext?, codePointFormat? }\` | \`ext\` defaults to \`".svg"\`. \`codePointFormat\`: \`"twemoji" \\| "openmoji" \\| "noto"\` (default \`"twemoji"\`) |

\`fallbacks\` accepts the CDN presets only. Duplicates of \`source\` are skipped.

### \`responsive\`

\`ResponsiveSvgOptions\`. \`responsive: true\` is \`{ mode: "intrinsic" }\`.

| Field | Type | Default |
| --- | --- | --- |
| \`mode\` | \`"intrinsic" \\| "relative" \\| "fill"\` | \`"intrinsic"\` |
| \`width\` | \`string\` | omitted |
| \`height\` | \`string\` | omitted |
| \`viewBox\` | \`string\` | omitted |

## PixelationOptions

Open **Pixelated** to spread \`pixelationPresets.nearest\` or \`pixelationPresets.smooth\` and set \`blockSize\`. Open **Custom pixelation stages** to override individual stage fields. Open **All pixelation options** to set every field. Each control there is named \`pixelation.blockSize\`, \`pixelation.downscale.[field]\`, or \`pixelation.upscale.[field]\`. Keep \`responsive\` fixed on those stories.

This is the whole object. Comments are the type references. \`emojiToSvg\` has no top-level canvas background, so an omitted stage \`background\` stays transparent.

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

\`responsive\` with this object throws \`IncompatibleOptionsError\`: \`responsive is incompatible with pixelation on emojiToSvg because pixelated output embeds a raster image\`. The number-only path uses that sentence with \`pixelate\` in place of \`pixelation\`. Active pixelation writes the inner SVG without an XML declaration. The wrapper still uses \`xmlDeclaration\`.

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
| \`IncompatibleOptionsError\` | \`responsive\` with \`pixelate >= 2\` or with \`pixelation\`, or \`pixelation.blockSize\` is not a finite number \`>= 2\` |
| \`RasterizeError\` | Canvas or image rasterization failed while embedding a pixelated PNG |

\`EmojiNotFoundError\` and \`EmojiFetchError\` try \`fallbacks\` when those are set. An aborted \`signal\` does not.
        `,
      },
    },
  },
} satisfies Meta<EmojiToSvgStoryArgs>;

export default meta;
type Story = StoryObj<EmojiToSvgStoryArgs>;

function resolveSource(args: EmojiToSvgStoryArgs): EmojiSource {
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

function resolveResponsive(args: EmojiToSvgStoryArgs) {
  if (args.responsiveMode === "intrinsic") {
    return true;
  }
  if (args.responsiveMode === "relative") {
    return { mode: "relative" as const, width: "1.2em", height: "1.2em" };
  }
  if (args.responsiveMode === "fill") {
    return { mode: "fill" as const, width: "100%", height: "100%" };
  }
  return undefined;
}

function storyPixelation(args: EmojiToSvgStoryArgs): PixelationOptions | undefined {
  if (args.pixelationPreset === "smooth" || args.pixelationPreset === "nearest") {
    return {
      ...pixelationPresets[args.pixelationPreset],
      blockSize: args.pixelationBlockSize,
    };
  }
  return undefined;
}

function renderSvgPreviewWith(
  args: EmojiToSvgStoryArgs,
  pixelationOverride?: PixelationOptions,
): HTMLDivElement {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "12px";
  root.style.fontFamily = "system-ui, sans-serif";
  root.style.maxWidth = "28rem";

  const status = document.createElement("p");
  status.textContent = "Loading…";
  status.style.margin = "0";
  status.style.color = "#666";

  const preview = document.createElement("div");
  preview.style.display = "flex";
  preview.style.alignItems = "center";
  preview.style.gap = "16px";

  if (args.responsiveMode === "fill") {
    preview.style.width = "96px";
    preview.style.height = "96px";
    preview.style.border = "1px dashed color-mix(in srgb, CanvasText 25%, Canvas)";
  }

  if (args.responsiveMode === "relative") {
    preview.style.fontSize = "48px";
  }

  const source = document.createElement("pre");
  source.style.margin = "0";
  source.style.padding = "12px";
  source.style.borderRadius = "8px";
  source.style.background = "color-mix(in srgb, CanvasText 8%, Canvas)";
  source.style.fontSize = "12px";
  source.style.whiteSpace = "pre-wrap";
  source.style.wordBreak = "break-word";
  source.style.maxHeight = "240px";
  source.style.overflow = "auto";

  root.append(status, preview, source);

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

  void emojiToSvg(args.emoji, {
    size: args.size,
    xmlDeclaration: args.xmlDeclaration,
    pixelate: pixelationOverride === undefined && args.pixelate >= 2 ? args.pixelate : undefined,
    pixelation,
    cache: args.cache,
    source: resolveSource(args),
    fallbacks: parseFallbacks(args.fallbacks),
    responsive: resolveResponsive(args),
  })
    .then((svg) => {
      status.textContent = `${args.emoji} · ${args.size}px`;
      preview.innerHTML = svg;
      source.textContent = svg;
    })
    .catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : "Failed to render SVG";
      preview.replaceChildren();
      source.textContent = "";
    });

  return root;
}

function renderSvgPreview(args: EmojiToSvgStoryArgs): HTMLDivElement {
  return renderSvgPreviewWith(args);
}

export const Default: Story = {
  render: renderSvgPreview,
};

export const WithXmlDeclaration: Story = {
  name: "With XML declaration",
  args: {
    emoji: "🎉",
    xmlDeclaration: true,
  },
  render: renderSvgPreview,
};

export const ZwjSequence: Story = {
  name: "ZWJ sequence",
  args: {
    emoji: "👨‍👩‍👧",
    size: 64,
  },
  render: renderSvgPreview,
};

export const CdnFallbacks: Story = {
  name: "CDN fallbacks",
  args: {
    emoji: "👨‍👩‍👧",
    sourceMode: "fluent",
    fallbacks: "twemoji,openmoji",
  },
  parameters: {
    docs: {
      description: {
        story: `
Fluent has no asset for 👨‍👩‍👧. \`fallbacks\` tries Twemoji, then OpenMoji.

\`\`\`ts
const svg = await emojiToSvg("👨‍👩‍👧", {
  source: "fluent",
  fallbacks: ["twemoji", "openmoji"],
});
\`\`\`
        `,
      },
    },
  },
  render: renderSvgPreview,
};

export const FluentColor: Story = {
  name: "Fluent color",
  args: {
    emoji: "😀",
    sourceMode: "fluent",
    fluentStyle: "color",
  },
  render: renderSvgPreview,
};

export const FluentFlat: Story = {
  name: "Fluent flat",
  args: {
    emoji: "👍",
    sourceMode: "fluent",
    fluentStyle: "flat",
  },
  render: renderSvgPreview,
};

export const Pixelated: Story = {
  name: "Pixelated",
  args: {
    emoji: "🧟",
    size: 96,
    pixelate: 0,
    pixelationPreset: "nearest",
    pixelationBlockSize: 12,
    responsiveMode: "fixed",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`pixelationPreset\` chooses \`pixelationPresets.nearest\` or \`pixelationPresets.smooth\`. \`pixelationBlockSize\` replaces that preset's \`blockSize\` and must be \`>= 2\`. It is ignored while the preset is \`off\`. The result is an SVG wrapper around a pixelated PNG. \`emojiToSvg\` has no native source.

\`\`\`ts
import { emojiToSvg, pixelationPresets } from "emoji-renderer";

const blockSize = 12;

const svg = await emojiToSvg("🧟", {
  size: 96,
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
  render: renderSvgPreview,
};

export const CustomPixelationStages: Story = {
  name: "Custom pixelation stages",
  args: {
    emoji: "🧟",
    size: 96,
    pixelate: 0,
    pixelationPreset: "off",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`quality\` has no effect while that stage's \`smoothing\` is off. An explicit stage \`background: null\` stays transparent. \`emojiToSvg\` has no top-level canvas background, so an omitted stage background stays transparent too. \`pixelation\` wins when \`pixelate\` is also passed.

\`\`\`ts
import { emojiToSvg, nearestPixelation } from "emoji-renderer";

await emojiToSvg("🧟", {
  size: 96,
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
    renderSvgPreviewWith(args, {
      ...nearestPixelation,
      blockSize: 6,
      downscale: { ...nearestPixelation.downscale, background: null },
      upscale: { smoothing: true, quality: "high" },
    }),
};

export const AllPixelationOptions: StoryObj<EmojiToSvgStoryArgs & PixelationDemoArgs> = {
  name: "All pixelation options",
  args: {
    emoji: "🧟",
    size: 96,
    pixelate: 0,
    pixelationPreset: "off",
    responsiveMode: "fixed",
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
          "Every `pixelation` field is a control. `omit` drops that stage `background` from the object. Keep responsive on fixed.",
      },
    },
  },
  render: (args) => renderSvgPreviewWith(args, pixelationFromDemoArgs(args)),
};

export const NoCache: Story = {
  name: "Cache disabled",
  args: {
    emoji: "🔥",
    cache: false,
  },
  render: renderSvgPreview,
};

export const ResponsiveIntrinsic: Story = {
  name: "Responsive intrinsic",
  args: {
    emoji: "😀",
    responsiveMode: "intrinsic",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const svg = await emojiToSvg("😀", { responsive: true });
container.innerHTML = svg;

// CSS controls display size — SVG scales cleanly at any size
container.style.width = "120px";
\`\`\`
        `,
      },
    },
  },
  render: (args) => {
    const root = renderSvgPreview(args);
    const preview = root.querySelector("div");
    if (preview instanceof HTMLElement) {
      preview.style.width = "120px";
    }
    return root;
  },
};

export const ResponsiveRelative: Story = {
  name: "Responsive relative (1.2em)",
  args: {
    emoji: "🎉",
    responsiveMode: "relative",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const svg = await emojiToSvg("🎉", {
  responsive: { mode: "relative", width: "1.2em", height: "1.2em" },
});
\`\`\`
        `,
      },
    },
  },
  render: renderSvgPreview,
};

export const ResponsiveFill: Story = {
  name: "Responsive fill container",
  args: {
    emoji: "🌈",
    responsiveMode: "fill",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const svg = await emojiToSvg("🌈", {
  responsive: { mode: "fill", width: "100%", height: "100%" },
});

// Place inside a sized container
const slot = document.querySelector(".emoji-slot")!;
slot.innerHTML = svg;
\`\`\`
        `,
      },
    },
  },
  render: renderSvgPreview,
};
