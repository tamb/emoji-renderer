import twemojiModule from "@twemoji/api";
import type { Twemoji } from "@twemoji/api";
import { InvalidEmojiError } from "./errors.ts";

const twemoji = twemojiModule as unknown as Twemoji;

const ZWJ = "\u200D";
const VS16 = "\uFE0F";

/**
 * Matches Twemoji parse: strip VS16 unless the sequence contains ZWJ.
 * Text-default emoji (coffin, keycaps, etc.) ship without `-fe0f` in CDN filenames.
 */
function normalizeEmojiForCodePoint(emoji: string): string {
  if (emoji.includes(ZWJ)) {
    return emoji;
  }

  return emoji.replaceAll(VS16, "");
}

export function emojiToCodePoint(emoji: string): string {
  if (typeof emoji !== "string" || emoji.trim().length === 0) {
    throw new InvalidEmojiError();
  }

  const trimmed = emoji.trim();
  return twemoji.convert.toCodePoint(normalizeEmojiForCodePoint(trimmed));
}
