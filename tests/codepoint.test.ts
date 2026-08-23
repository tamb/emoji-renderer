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

  test("strips VS16 from text-default emoji such as coffin", () => {
    expect(emojiToCodePoint("⚰️")).toBe("26b0");
    expect(emojiToCodePoint("⚰")).toBe("26b0");
  });

  test("strips VS16 from keycap sequences", () => {
    expect(emojiToCodePoint("1️⃣")).toBe("31-20e3");
  });

  test("preserves ZWJ family sequences", () => {
    expect(emojiToCodePoint("👨‍👩‍👧")).toBe("1f468-200d-1f469-200d-1f467");
  });

  test("preserves VS16 in ZWJ sequences", () => {
    expect(emojiToCodePoint("👨‍⚕️")).toBe("1f468-200d-2695-fe0f");
  });
});
