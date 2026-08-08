import type { ResponsiveSvg } from "./types.ts";
import { resolveResponsiveSvg } from "./responsive.ts";

const DEFAULT_SIZE = 72;
const DEFAULT_VIEWBOX = "0 0 36 36";

export interface NormalizeSvgOptions {
  svg: string;
  size?: number;
  xmlDeclaration?: boolean;
  responsive?: ResponsiveSvg;
}

function readViewBox(attributes: string): string | null {
  const match = attributes.match(/\bviewBox=("[^"]*"|'[^']*'|\S+)/i);
  if (!match) {
    return null;
  }

  const value = match[1]!;
  return value.replace(/^['"]|['"]$/g, "");
}

function ensureViewBox(attributes: string, viewBox: string): string {
  if (/\bviewBox=/i.test(attributes)) {
    return attributes;
  }

  const trimmed = attributes.trim();
  return trimmed.length > 0 ? `${trimmed} viewBox="${viewBox}"` : `viewBox="${viewBox}"`;
}

function buildSvgOpenTag(
  attributes: string,
  options: {
    size: number;
    responsive: ReturnType<typeof resolveResponsiveSvg>;
  },
): string {
  const withoutDimensions = attributes
    .replace(/\s(width|height)=("[^"]*"|'[^']*'|\S+)/gi, "")
    .trim();

  if (!options.responsive) {
    const attrs = withoutDimensions.length > 0 ? ` ${withoutDimensions}` : "";
    return `<svg width="${options.size}" height="${options.size}"${attrs}>`;
  }

  const viewBox = options.responsive.viewBox ?? readViewBox(withoutDimensions) ?? DEFAULT_VIEWBOX;
  let attrs = ensureViewBox(withoutDimensions, viewBox);

  if (options.responsive.mode === "relative") {
    const width = options.responsive.width ?? "1em";
    const height = options.responsive.height ?? "1em";
    attrs = `${attrs} width="${width}" height="${height}"`;
  } else if (options.responsive.mode === "fill") {
    const width = options.responsive.width ?? "100%";
    const height = options.responsive.height ?? "100%";
    attrs = `${attrs} width="${width}" height="${height}"`;
  }

  return `<svg ${attrs}>`;
}

export function normalizeSvg(options: NormalizeSvgOptions): string {
  const { svg, size = DEFAULT_SIZE, xmlDeclaration = false, responsive } = options;
  const resolvedResponsive = resolveResponsiveSvg(responsive);

  const withSize = svg.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) =>
    buildSvgOpenTag(attributes, { size, responsive: resolvedResponsive }),
  );

  if (!xmlDeclaration) {
    return withSize.replace(/^\s*<\?xml[^?]*\?>\s*/i, "");
  }

  if (/^\s*<\?xml/i.test(withSize)) {
    return withSize;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${withSize}`;
}
