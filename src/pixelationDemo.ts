import type {
  PixelationDownscaleOptions,
  PixelationOptions,
  PixelationRounding,
  PixelationScaleOptions,
  PixelationSmoothingQuality,
} from "./pixelation.ts";

export const PIXELATION_BACKGROUND_CHOICES = [
  "omit",
  "null",
  "#ffffff",
  "#1a1a2e",
  "#ffcc00",
] as const;

export type PixelationBackgroundChoice = (typeof PIXELATION_BACKGROUND_CHOICES)[number];

/** Storybook args whose names are the public `pixelation` paths. */
export interface PixelationDemoArgs {
  "pixelation.blockSize": number;
  "pixelation.downscale.smoothing": boolean;
  "pixelation.downscale.quality": PixelationSmoothingQuality;
  "pixelation.downscale.rounding": PixelationRounding;
  "pixelation.downscale.background": PixelationBackgroundChoice;
  "pixelation.upscale.smoothing": boolean;
  "pixelation.upscale.quality": PixelationSmoothingQuality;
  "pixelation.upscale.background": PixelationBackgroundChoice;
}

export const pixelationDemoArgs = {
  "pixelation.blockSize": 8,
  "pixelation.downscale.smoothing": true,
  "pixelation.downscale.quality": "low",
  "pixelation.downscale.rounding": "floor",
  "pixelation.downscale.background": "null",
  "pixelation.upscale.smoothing": false,
  "pixelation.upscale.quality": "low",
  "pixelation.upscale.background": "#1a1a2e",
} as const satisfies PixelationDemoArgs;

const hiddenControl = { control: false, table: { disable: true } } as const;

export const pixelationDemoArgTypes = {
  "pixelation.blockSize": {
    name: "pixelation.blockSize",
    control: { type: "number", min: 2, max: 32, step: 1 },
    description: "PixelationOptions.blockSize. Finite number >= 2.",
    table: { category: "pixelation", type: { summary: "number" } },
  },
  "pixelation.downscale.smoothing": {
    name: "pixelation.downscale.smoothing",
    control: "boolean",
    description: "PixelationDownscaleOptions.smoothing. imageSmoothingEnabled on the shrink.",
    table: {
      category: "pixelation",
      subcategory: "downscale",
      type: { summary: "boolean" },
    },
  },
  "pixelation.downscale.quality": {
    name: "pixelation.downscale.quality",
    control: "select",
    options: ["low", "medium", "high"],
    description: "PixelationDownscaleOptions.quality. PixelationSmoothingQuality.",
    table: {
      category: "pixelation",
      subcategory: "downscale",
      type: { summary: "PixelationSmoothingQuality" },
    },
  },
  "pixelation.downscale.rounding": {
    name: "pixelation.downscale.rounding",
    control: "select",
    options: ["floor", "round"],
    description: "PixelationDownscaleOptions.rounding. PixelationRounding.",
    table: {
      category: "pixelation",
      subcategory: "downscale",
      type: { summary: "PixelationRounding" },
    },
  },
  "pixelation.downscale.background": {
    name: "pixelation.downscale.background",
    control: "select",
    options: [...PIXELATION_BACKGROUND_CHOICES],
    description:
      "PixelationDownscaleOptions.background. `omit` leaves the field off the object. `null` is explicit transparent. A color is `string`.",
    table: {
      category: "pixelation",
      subcategory: "downscale",
      type: { summary: "string | null" },
    },
  },
  "pixelation.upscale.smoothing": {
    name: "pixelation.upscale.smoothing",
    control: "boolean",
    description: "PixelationScaleOptions.smoothing. imageSmoothingEnabled on the enlarge.",
    table: {
      category: "pixelation",
      subcategory: "upscale",
      type: { summary: "boolean" },
    },
  },
  "pixelation.upscale.quality": {
    name: "pixelation.upscale.quality",
    control: "select",
    options: ["low", "medium", "high"],
    description: "PixelationScaleOptions.quality. PixelationSmoothingQuality.",
    table: {
      category: "pixelation",
      subcategory: "upscale",
      type: { summary: "PixelationSmoothingQuality" },
    },
  },
  "pixelation.upscale.background": {
    name: "pixelation.upscale.background",
    control: "select",
    options: [...PIXELATION_BACKGROUND_CHOICES],
    description:
      "PixelationScaleOptions.background. `omit` leaves the field off the object. `null` is explicit transparent. A color is `string`.",
    table: {
      category: "pixelation",
      subcategory: "upscale",
      type: { summary: "string | null" },
    },
  },
  pixelate: hiddenControl,
  pixelationPreset: hiddenControl,
  pixelationBlockSize: hiddenControl,
} as const;

function stageBackground(choice: PixelationBackgroundChoice): string | null | undefined {
  if (choice === "omit") {
    return undefined;
  }
  if (choice === "null") {
    return null;
  }
  return choice;
}

export function pixelationFromDemoArgs(args: PixelationDemoArgs): PixelationOptions {
  const downscale: PixelationDownscaleOptions = {
    smoothing: args["pixelation.downscale.smoothing"],
    quality: args["pixelation.downscale.quality"],
    rounding: args["pixelation.downscale.rounding"],
  };
  const downscaleBackground = stageBackground(args["pixelation.downscale.background"]);
  if (downscaleBackground !== undefined) {
    downscale.background = downscaleBackground;
  }

  const upscale: PixelationScaleOptions = {
    smoothing: args["pixelation.upscale.smoothing"],
    quality: args["pixelation.upscale.quality"],
  };
  const upscaleBackground = stageBackground(args["pixelation.upscale.background"]);
  if (upscaleBackground !== undefined) {
    upscale.background = upscaleBackground;
  }

  return {
    blockSize: args["pixelation.blockSize"],
    downscale,
    upscale,
  };
}

function formatBackground(value: string | null | undefined, path: string): string {
  if (value === undefined) {
    return `    // ${path} omitted`;
  }
  const literal = value === null ? "null" : JSON.stringify(value);
  return `    background: ${literal}, // string | null — ${path}`;
}

/** Live object shown beside the demo, with the same type names as the docs. */
export function formatPixelationDemo(pixelation: PixelationOptions): string {
  const downscale = pixelation.downscale ?? {};
  const upscale = pixelation.upscale ?? {};

  return [
    "const pixelation = {",
    `  blockSize: ${pixelation.blockSize}, // number — pixelation.blockSize`,
    "  downscale: { // PixelationDownscaleOptions",
    `    smoothing: ${String(downscale.smoothing)}, // boolean — pixelation.downscale.smoothing`,
    `    quality: ${JSON.stringify(downscale.quality)}, // PixelationSmoothingQuality — pixelation.downscale.quality`,
    `    rounding: ${JSON.stringify(downscale.rounding)}, // PixelationRounding — pixelation.downscale.rounding`,
    formatBackground(downscale.background, "pixelation.downscale.background"),
    "  },",
    "  upscale: { // PixelationScaleOptions",
    `    smoothing: ${String(upscale.smoothing)}, // boolean — pixelation.upscale.smoothing`,
    `    quality: ${JSON.stringify(upscale.quality)}, // PixelationSmoothingQuality — pixelation.upscale.quality`,
    formatBackground(upscale.background, "pixelation.upscale.background"),
    "  },",
    "} satisfies PixelationOptions;",
  ].join("\n");
}
