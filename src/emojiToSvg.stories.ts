import type { Meta, StoryObj } from "@storybook/html-vite";
import type { EmojiSource } from "./types.ts";
import { emojiToSvg } from "./emojiToSvg.ts";

interface EmojiToSvgStoryArgs {
  emoji: string;
  size: number;
  xmlDeclaration: boolean;
  pixelate: number;
  cache: boolean;
  sourceMode: "twemoji" | "custom";
  responsiveMode: "fixed" | "intrinsic" | "relative" | "fill";
  customBaseUrl: string;
  customExt: string;
}

const meta = {
  title: "Emoji/emojiToSvg",
  tags: ["autodocs"],
  args: {
    emoji: "😀",
    size: 72,
    xmlDeclaration: false,
    pixelate: 0,
    cache: true,
    sourceMode: "twemoji",
    responsiveMode: "fixed",
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
      description: "Width and height applied to the SVG element. Default: 72.",
    },
    xmlDeclaration: {
      control: "boolean",
      description: 'Prefix the SVG with `<?xml version="1.0" encoding="UTF-8"?>`. Default: false.',
    },
    pixelate: {
      control: { type: "number", min: 0, max: 32, step: 1 },
      description:
        "Block size in output pixels. `>= 2` rasterizes and embeds a pixelated PNG inside the SVG. Incompatible with responsive. Default: off.",
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
      options: ["twemoji", "custom"],
      description: 'Asset source. `"twemoji"` uses the default jsDelivr CDN.',
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
  },
  parameters: {
    docs: {
      description: {
        component: `
Fetches Twemoji SVG artwork for an emoji and returns inline SVG markup.

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

**Pixelated raster embedded in SVG**

\`\`\`ts
const svg = await emojiToSvg("👾", { size: 96, pixelate: 8 });
// Incompatible with responsive — throws IncompatibleOptionsError
\`\`\`

**Custom CDN source**

\`\`\`ts
const svg = await emojiToSvg("😀", {
  source: {
    baseUrl: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg",
    ext: ".svg",
  },
});
\`\`\`

**Options**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| \`size\` | \`number\` | \`72\` | Width and height in pixels |
| \`source\` | \`"twemoji" \\| { baseUrl, ext? }\` | \`"twemoji"\` | CDN or custom asset base |
| \`fetch\` | \`typeof fetch\` | \`globalThis.fetch\` | Custom fetch (not exposed here) |
| \`cache\` | \`boolean\` | \`true\` | Cache fetched SVG text |
| \`signal\` | \`AbortSignal\` | — | Abort in-flight fetch (not exposed here) |
| \`xmlDeclaration\` | \`boolean\` | \`false\` | Include \`<?xml ...?>\` prefix |
| \`pixelate\` | \`number\` | off | Block size in px; \`>= 2\` embeds a pixelated raster in SVG |
| \`responsive\` | \`boolean \\| { mode, width?, height? }\` | off | CSS-scalable SVG output |
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
    };
  }
  return "twemoji";
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

function renderSvgPreview(args: EmojiToSvgStoryArgs): HTMLDivElement {
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

  void emojiToSvg(args.emoji, {
    size: args.size,
    xmlDeclaration: args.xmlDeclaration,
    pixelate: args.pixelate >= 2 ? args.pixelate : undefined,
    cache: args.cache,
    source: resolveSource(args),
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

export const Pixelated: Story = {
  name: "Pixelated raster SVG",
  args: {
    emoji: "👾",
    size: 96,
    pixelate: 8,
  },
  parameters: {
    docs: {
      description: {
        story: `
\`\`\`ts
const svg = await emojiToSvg("👾", { size: 96, pixelate: 8 });
document.querySelector("#target")!.innerHTML = svg;
\`\`\`
        `,
      },
    },
  },
  render: renderSvgPreview,
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
