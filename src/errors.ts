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

export class RasterizeError extends Error {
  readonly name = "RasterizeError";

  constructor(message = "Unable to rasterize SVG to an image") {
    super(message);
  }
}
