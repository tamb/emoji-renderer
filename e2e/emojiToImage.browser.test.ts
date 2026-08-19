import { describe, expect, test } from "vite-plus/test";
import { emojiToImage } from "../src/emojiToImage.ts";
import { emojiToSvg } from "../src/emojiToSvg.ts";

describe("emoji renderer browser integration", () => {
  test("fetches real Twemoji SVG and rasterizes to an image", async () => {
    const svg = await emojiToSvg("😀", { size: 64, cache: false });
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="64"');

    const image = await emojiToImage("😀", { source: "twemoji", size: 64, cache: false });
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.naturalHeight).toBeGreaterThan(0);
  });

  test("fetches OpenMoji and Noto SVG presets", async () => {
    const openmoji = await emojiToSvg("😀", { source: "openmoji", size: 48, cache: false });
    const noto = await emojiToSvg("😀", { source: "noto", size: 48, cache: false });

    expect(openmoji).toContain("<svg");
    expect(noto).toContain("<svg");
  });

  test("defaults emojiToImage to native system emoji", async () => {
    const dataUrl = await emojiToImage("🎉", {
      format: "dataUrl",
      size: 48,
    });

    expect(typeof dataUrl).toBe("string");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("supports ZWJ emoji in the browser", async () => {
    const svg = await emojiToSvg("👨‍👩‍👧", { size: 48, cache: false });
    expect(svg).toContain("<svg");
  });

  test("pixelates emoji output in the browser", async () => {
    const sharp = await emojiToImage("😀", { size: 64 });
    const pixelated = await emojiToImage("😀", { size: 64, pixelate: 8 });

    expect(sharp).toBeInstanceOf(HTMLImageElement);
    expect(pixelated).toBeInstanceOf(HTMLImageElement);
    expect(pixelated.src).not.toBe(sharp.src);
  });

  test("renders native system emoji without fetching CDN assets", async () => {
    const image = await emojiToImage("😀", { source: "native", size: 64 });
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.naturalHeight).toBeGreaterThan(0);
  });

  test("returns viewBox-only SVG when responsive is enabled", async () => {
    const svg = await emojiToSvg("😀", { responsive: true, cache: false });
    expect(svg).toContain('viewBox="0 0 36 36"');
    expect(svg).not.toMatch(/\swidth="/);
  });

  test("builds srcset image variants in the browser", async () => {
    const image = await emojiToImage("😀", {
      size: 48,
      srcSet: [24, 48],
      responsive: { dpr: 1, display: "css" },
    });

    expect(image.srcset).toContain("24w");
    expect(image.srcset).toContain("48w");
    expect(image.style.width).toBe("48px");
  });
});
