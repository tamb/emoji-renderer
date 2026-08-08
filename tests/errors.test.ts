import { describe, expect, test } from "vite-plus/test";
import { EmojiNotFoundError, InvalidEmojiError, RasterizeError } from "../src/errors.ts";

describe("errors", () => {
  test("InvalidEmojiError uses the default message", () => {
    const error = new InvalidEmojiError();
    expect(error.name).toBe("InvalidEmojiError");
    expect(error.message).toBe("Emoji must be a non-empty string");
  });

  test("InvalidEmojiError accepts a custom message", () => {
    const error = new InvalidEmojiError("bad emoji");
    expect(error.message).toBe("bad emoji");
  });

  test("EmojiNotFoundError includes emoji and url", () => {
    const error = new EmojiNotFoundError("😀", "https://example.com/1f600.svg");
    expect(error.name).toBe("EmojiNotFoundError");
    expect(error.emoji).toBe("😀");
    expect(error.url).toBe("https://example.com/1f600.svg");
    expect(error.message).toContain("😀");
    expect(error.message).toContain("https://example.com/1f600.svg");
  });

  test("RasterizeError uses default and custom messages", () => {
    const defaultError = new RasterizeError();
    expect(defaultError.name).toBe("RasterizeError");
    expect(defaultError.message).toBe("Unable to rasterize SVG to an image");

    const customError = new RasterizeError("canvas missing");
    expect(customError.message).toBe("canvas missing");
  });
});
