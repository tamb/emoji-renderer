import { describe, expect, test } from "vite-plus/test";
import { emojiToImage } from "../src/emojiToImage.ts";
import { emojiToSvg } from "../src/emojiToSvg.ts";

describe("emoji renderer mobile browser integration", () => {
  test("emulates a high-DPR phone viewport", () => {
    expect(window.innerWidth).toBeLessThanOrEqual(430);
    expect(window.devicePixelRatio).toBeGreaterThan(2);
  });

  test("renders CDN and native emoji on a phone-sized canvas", async () => {
    const [svg, twemoji, native] = await Promise.all([
      emojiToSvg("😀", { size: 48, cache: false }),
      emojiToImage("😀", { source: "twemoji", size: 48, cache: false }),
      emojiToImage("👑", { source: "native", size: 64 }),
    ]);

    expect(svg).toContain("<svg");
    expect(twemoji).toBeInstanceOf(HTMLImageElement);
    expect(twemoji.naturalWidth).toBeGreaterThan(0);
    expect(native).toBeInstanceOf(HTMLImageElement);
    expect(native.naturalWidth).toBeGreaterThan(0);
  });
});
