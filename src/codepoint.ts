import twemojiModule from "@twemoji/api";
import type { Twemoji } from "@twemoji/api";
import { InvalidEmojiError } from "./errors.ts";

const twemoji = twemojiModule as unknown as Twemoji;

export function emojiToCodePoint(emoji: string): string {
  if (typeof emoji !== "string" || emoji.trim().length === 0) {
    throw new InvalidEmojiError();
  }

  return twemoji.convert.toCodePoint(emoji.trim());
}
