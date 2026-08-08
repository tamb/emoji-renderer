import { describe, expect, test } from "vite-plus/test";
import { emojiToCodePoint } from "../src/codepoint.ts";
import { InvalidEmojiError } from "../src/errors.ts";

describe("emojiToCodePoint", () => {
  test("converts a single emoji", () => {
    expect(emojiToCodePoint("😀")).toBe("1f600");
  });

  test("trims surrounding whitespace", () => {
    expect(emojiToCodePoint("  😀  ")).toBe("1f600");
  });

  test("throws InvalidEmojiError for empty strings", () => {
    expect(() => emojiToCodePoint("   ")).toThrow(InvalidEmojiError);
  });

  test("throws InvalidEmojiError for non-string input", () => {
    expect(() => emojiToCodePoint(null as unknown as string)).toThrow(InvalidEmojiError);
  });
});
