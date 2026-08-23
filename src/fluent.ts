import { EmojiNotFoundError } from "./errors.ts";
import fluentMapJson from "./generated/fluent-map.json" with { type: "json" };
import type { FluentEmojiSource, FluentStyle } from "./types.ts";

export const DEFAULT_FLUENT_STYLE: FluentStyle = "color";
export const FLUENT_COMMIT = "62ecdc0d7ca5c6df32148c169556bc8d3782fca4";
export const FLUENT_ASSET_BASE = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_COMMIT}/assets`;

type FluentMapValue = string | [folder: string, tone: string];
const fluentMap = fluentMapJson as unknown as Record<string, FluentMapValue>;

const STYLE_META = {
  color: { dir: "Color", suffix: "color", ext: ".svg" },
  flat: { dir: "Flat", suffix: "flat", ext: ".svg" },
  "high-contrast": { dir: "High Contrast", suffix: "high_contrast", ext: ".svg" },
  "3d": { dir: "3D", suffix: "3d", ext: ".png" },
} as const;

const TONE_FILE: Record<string, string> = {
  Default: "default",
  Light: "light",
  "Medium-Light": "medium_light",
  Medium: "medium",
  "Medium-Dark": "medium_dark",
  Dark: "dark",
};

export interface ResolvedFluentSource {
  style: FluentStyle;
  baseUrl: string;
}

export function isFluentSource(source: unknown): source is "fluent" | FluentEmojiSource {
  return (
    source === "fluent" ||
    (typeof source === "object" &&
      source !== null &&
      "preset" in source &&
      (source as { preset?: unknown }).preset === "fluent")
  );
}

export function resolveFluentSource(source: "fluent" | FluentEmojiSource): ResolvedFluentSource {
  if (source === "fluent") {
    return { style: DEFAULT_FLUENT_STYLE, baseUrl: FLUENT_ASSET_BASE };
  }

  return {
    style: source.style ?? DEFAULT_FLUENT_STYLE,
    baseUrl: (source.baseUrl ?? FLUENT_ASSET_BASE).replace(/\/$/, ""),
  };
}

export function isFluentRasterStyle(style: FluentStyle): boolean {
  return style === "3d";
}

function stripFe0f(codePoint: string): string {
  return codePoint
    .replace(/(?:^|-)fe0f(?=-|$)/g, "")
    .replace(/^-|-$/g, "")
    .replace(/--+/g, "-");
}

export function lookupFluentEntry(codePoint: string): FluentMapValue | undefined {
  const key = codePoint.toLowerCase();
  return fluentMap[key] ?? fluentMap[stripFe0f(key)];
}

export function folderToFileStem(folder: string): string {
  return folder
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function encodePathSegments(segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export function buildFluentAssetUrl(
  codePoint: string,
  source: "fluent" | FluentEmojiSource = "fluent",
): string {
  const { style, baseUrl } = resolveFluentSource(source);
  const entry = lookupFluentEntry(codePoint);

  if (entry === undefined) {
    throw new EmojiNotFoundError(codePoint, `${baseUrl}/<unmapped ${codePoint}>`);
  }

  const [folder, tone] = typeof entry === "string" ? [entry, undefined] : entry;

  if (style === "high-contrast" && tone !== undefined && tone !== "Default") {
    throw new EmojiNotFoundError(
      codePoint,
      `${baseUrl}/${encodePathSegments([folder, tone, "High Contrast"])}`,
    );
  }

  const { dir, suffix, ext } = STYLE_META[style];
  const stem = folderToFileStem(folder);
  const fileName =
    tone === undefined ? `${stem}_${suffix}${ext}` : `${stem}_${suffix}_${TONE_FILE[tone]}${ext}`;
  const parts = tone === undefined ? [folder, dir, fileName] : [folder, tone, dir, fileName];

  return `${baseUrl}/${encodePathSegments(parts)}`;
}

export function wrapPngAsSvg(dataUrl: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="${dataUrl}" width="32" height="32" /></svg>`;
}
