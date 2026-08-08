import type { Meta, StoryObj } from "@storybook/html-vite";
import type { EmojiImageFormat, EmojiImageSource } from "./types.ts";
import { emojiToImage } from "./emojiToImage.ts";

interface EmojiToImageStoryArgs {
  emoji: string;
  size: number;
  format: EmojiImageFormat;
  mimeType: "image/png" | "image/webp";
  background: string;
  pixelate: number;
  cache: boolean;
  sourceMode: "twemoji" | "native" | "custom";
  fontFamily: string;
  responsive: boolean;
  srcSet: string;
  sizes: string;
  customBaseUrl: string;
  customExt: string;
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
    cache: true,
    sourceMode: "twemoji",
    fontFamily: "",
    responsive: false,
    srcSet: "",
    sizes: "(max-width: 600px) 24px, 48px",
    customBaseUrl: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg",
    customExt: ".svg",
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
        "Block size in output pixels. `0` or `1` disables pixelation; `8` on a 72px emoji yields ~9×9 blocks. Default: off.",
    },
    cache: {
      control: "boolean",
      description: "Cache fetched SVG text in memory. Default: true.",
    },
    sourceMode: {
      control: "select",
      options: ["twemoji", "native", "custom"],
      description:
        'Asset source. `"twemoji"` uses the default jsDelivr CDN. `"native"` draws the system emoji font via canvas.',
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
  },
  parameters: {
    docs: {
      description: {
        component: `
Fetches Twemoji SVG artwork, rasterizes it via canvas, and returns an image.

## Usage

\`\`\`ts
import { emojiToImage } from "emoji-renderer/emojiToImage";

const image = await emojiToImage("😀", { size: 48 });
document.body.append(image);
\`\`\`

Tree-shakable import from the package root also works:

\`\`\`ts
import { emojiToImage } from "emoji-renderer";

const image = await emojiToImage("🎉");
\`\`\`

## Examples

**HTMLImageElement (default)**

\`\`\`ts
const image = await emojiToImage("😀", { size: 48 });
\`\`\`

**Blob or data URL output**

\`\`\`ts
const blob = await emojiToImage("😀", { format: "blob" });
const dataUrl = await emojiToImage("😀", { format: "dataUrl" });
\`\`\`

**Responsive — retina-sharp with CSS display size**

\`\`\`ts
const image = await emojiToImage("😀", {
  size: 48,
  responsive: true, // dpr: auto, display: css
});
document.body.append(image);
\`\`\`

**Explicit responsive options**

\`\`\`ts
const image = await emojiToImage("😀", {
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
  size: 48,
  srcSet: [24, 48, 96],
  sizes: "(max-width: 600px) 24px, 48px",
  responsive: { dpr: "auto", display: "css" },
});
// image.srcset and image.sizes are set automatically
document.body.append(image);
\`\`\`

**Native system emoji (no CDN fetch)**

\`\`\`ts
const image = await emojiToImage("😀", {
  source: "native",
  size: 48,
});
\`\`\`

**Pixelated output**

\`\`\`ts
const image = await emojiToImage("👾", {
  size: 96,
  pixelate: 8,
  background: "#1a1a2e",
});
\`\`\`

**Options**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| \`size\` | \`number\` | \`72\` | Width and height in pixels |
| \`source\` | \`"twemoji" \\| "native" \\| { baseUrl, ext? }\` | \`"twemoji"\` | CDN, system emoji font, or custom asset base |
| \`fetch\` | \`typeof fetch\` | \`globalThis.fetch\` | Custom fetch (not exposed here) |
| \`cache\` | \`boolean\` | \`true\` | Cache fetched SVG text |
| \`signal\` | \`AbortSignal\` | — | Abort in-flight fetch (not exposed here) |
| \`format\` | \`"image" \\| "blob" \\| "dataUrl"\` | \`"image"\` | Return type |
| \`mimeType\` | \`"image/png" \\| "image/webp"\` | \`"image/png"\` | Output MIME type |
| \`background\` | \`string \\| null\` | \`null\` | Canvas fill before drawing |
| \`pixelate\` | \`number\` | off | Block size in px; \`>= 2\` enables pixel-art upscaling |
| \`fontFamily\` | \`string\` | emoji stack | Font stack when \`source\` is \`"native"\` |
| \`responsive\` | \`boolean \\| { dpr, display, style? }\` | off | Retina rendering + CSS display sizing |
| \`srcSet\` | \`number[]\` | off | Logical widths for \`<img srcset>\` (requires \`format: "image"\`) |
| \`sizes\` | \`string\` | — | Optional \`<img sizes>\` attribute |
        `,
      },
    },
  },
} satisfies Meta<EmojiToImageStoryArgs>;

export default meta;
type Story = StoryObj<EmojiToImageStoryArgs>;

function resolveSource(args: EmojiToImageStoryArgs): EmojiImageSource {
  if (args.sourceMode === "native") {
    return "native";
  }
  if (args.sourceMode === "custom") {
    return {
      baseUrl: args.customBaseUrl,
      ext: args.customExt || ".svg",
    };
  }
  return "twemoji";
}

function parseSrcSet(value: string): number[] | undefined {
  const widths = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((width) => Number.isFinite(width) && width > 0);

  return widths.length > 0 ? widths : undefined;
}

function renderImagePreview(args: EmojiToImageStoryArgs): HTMLDivElement {
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

  void emojiToImage(args.emoji, {
    size: args.size,
    format: args.format,
    mimeType: args.mimeType,
    background: args.background || null,
    pixelate: args.pixelate >= 2 ? args.pixelate : undefined,
    cache: args.cache,
    source: resolveSource(args),
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
const blob = await emojiToImage("🎉", { format: "blob" });
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
const dataUrl = await emojiToImage("🌈", { format: "dataUrl" });
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
    emoji: "👾",
    size: 96,
    pixelate: 8,
    background: "#1a1a2e",
  },
  render: renderImagePreview,
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

export const NativeSource: Story = {
  name: "Native system emoji",
  args: {
    emoji: "😀",
    size: 96,
    sourceMode: "native",
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const image = await emojiToImage("😀", {
  source: "native",
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
