import type { ResponsiveImage, ResponsiveSvg } from "./types.ts";

export type ResponsiveSvgMode = "intrinsic" | "relative" | "fill";

export interface ResolvedResponsiveSvg {
  mode: ResponsiveSvgMode;
  width?: string;
  height?: string;
  viewBox?: string;
}

export interface ResolvedResponsiveImage {
  dpr: number;
  display: "fixed" | "css";
  style?: {
    width?: string;
    height?: string;
    objectFit?: "contain" | "cover" | "fill";
  };
}

export function resolveResponsiveSvg(
  responsive: ResponsiveSvg | undefined,
): ResolvedResponsiveSvg | null {
  if (!responsive) {
    return null;
  }

  if (responsive === true) {
    return { mode: "intrinsic" };
  }

  return {
    mode: responsive.mode ?? "intrinsic",
    width: responsive.width,
    height: responsive.height,
    viewBox: responsive.viewBox,
  };
}

export function resolveResponsiveImage(
  responsive: ResponsiveImage | undefined,
  logicalSize: number,
): ResolvedResponsiveImage {
  if (!responsive) {
    return { dpr: 1, display: "fixed" };
  }

  if (responsive === true) {
    return {
      dpr: resolveDevicePixelRatio(),
      display: "css",
      style: {
        width: `${logicalSize}px`,
        height: `${logicalSize}px`,
      },
    };
  }

  const dpr =
    responsive.dpr === undefined || responsive.dpr === "auto"
      ? resolveDevicePixelRatio()
      : responsive.dpr;

  const display = responsive.display ?? "css";

  return {
    dpr,
    display,
    style:
      responsive.style ??
      (display === "css"
        ? {
            width: `${logicalSize}px`,
            height: `${logicalSize}px`,
          }
        : undefined),
  };
}

export function resolveDevicePixelRatio(): number {
  if (typeof globalThis.devicePixelRatio === "number" && globalThis.devicePixelRatio > 0) {
    return globalThis.devicePixelRatio;
  }

  return 1;
}

export function resolveRenderSize(logicalSize: number, dpr: number): number {
  return Math.max(1, Math.round(logicalSize * dpr));
}

export function normalizeSrcSetWidths(srcSet: number[], fallbackSize: number): number[] {
  const widths = [...new Set(srcSet.filter((width) => width > 0))].sort((a, b) => a - b);

  if (widths.length === 0) {
    return [fallbackSize];
  }

  return widths;
}

export function resolveDefaultSrcWidth(widths: number[], size: number): number {
  if (widths.includes(size)) {
    return size;
  }

  return widths[widths.length - 1]!;
}

export function applyImageDisplay(
  image: HTMLImageElement,
  logicalSize: number,
  resolved: ResolvedResponsiveImage,
): void {
  if (resolved.display === "css") {
    image.style.width = resolved.style?.width ?? `${logicalSize}px`;
    image.style.height = resolved.style?.height ?? `${logicalSize}px`;

    if (resolved.style?.objectFit) {
      image.style.objectFit = resolved.style.objectFit;
    }

    return;
  }

  image.width = logicalSize;
  image.height = logicalSize;
}
