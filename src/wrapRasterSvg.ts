export interface WrapRasterSvgOptions {
  dataUrl: string;
  size: number;
  xmlDeclaration?: boolean;
}

export function wrapRasterSvg(options: WrapRasterSvgOptions): string {
  const { dataUrl, size, xmlDeclaration = false } = options;

  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="${dataUrl}" width="${size}" height="${size}" /></svg>`;

  if (!xmlDeclaration) {
    return markup;
  }

  if (/^\s*<\?xml/i.test(markup)) {
    return markup;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}
