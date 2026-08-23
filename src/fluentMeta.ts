import type { FluentEmojiSource, FluentStyle } from "./types.ts";

export const DEFAULT_FLUENT_STYLE: FluentStyle = "color";
export const FLUENT_COMMIT = "62ecdc0d7ca5c6df32148c169556bc8d3782fca4";
export const FLUENT_ASSET_BASE = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_COMMIT}/assets`;

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
