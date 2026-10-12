export class IncompatibleOptionsError extends Error {
  readonly name = "IncompatibleOptionsError";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidEmojiError extends Error {
  readonly name = "InvalidEmojiError";

  constructor(message = "Emoji must be a non-empty string") {
    super(message);
  }
}

export class EmojiNotFoundError extends Error {
  readonly name = "EmojiNotFoundError";

  constructor(
    public readonly emoji: string,
    public readonly url: string,
  ) {
    super(`No SVG found for emoji "${emoji}" at ${url}`);
  }
}

export class EmojiFetchError extends Error {
  readonly name = "EmojiFetchError";

  constructor(
    public readonly emoji: string,
    public readonly url: string,
    public readonly status?: number,
    options?: { cause?: unknown },
  ) {
    const statusPart = status === undefined ? "" : ` (HTTP ${status})`;
    super(`Failed to fetch emoji "${emoji}" from ${url}${statusPart}`, options);
  }
}

export const NODE_CANVAS_INSTALL_HINT =
  'Install optional peers "@napi-rs/canvas" and "@resvg/resvg-js" to rasterize emoji images in Node.js';

export class RasterizeError extends Error {
  readonly name = "RasterizeError";

  constructor(message = "Unable to rasterize SVG to an image", options?: { cause?: unknown }) {
    super(message, options);
  }
}
