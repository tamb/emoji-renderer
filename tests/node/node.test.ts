import { describe, expect, test } from "vite-plus/test";
import { emojiToImage } from "../../src/emojiToImage.ts";
import { emojiToSvg } from "../../src/emojiToSvg.ts";
import { NODE_CANVAS_INSTALL_HINT } from "../../src/canvasEnv.ts";
import { RasterizeError } from "../../src/errors.ts";
import { mockTwemojiFetch, SAMPLE_SVG } from "../helpers.ts";

const hasNodeCanvas = await import("@napi-rs/canvas").then(() => true).catch(() => false);

describe.runIf(hasNodeCanvas)("node integration", () => {
  test("fetches SVG with mock fetch in Node", async () => {
    const svg = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(SAMPLE_SVG),
      cache: false,
      size: 48,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('width="48"');
  });

  test("rasterizes to a blob with @napi-rs/canvas", async () => {
    const blob = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(SAMPLE_SVG),
      format: "blob",
      cache: false,
      size: 48,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("returns a data URL in Node", async () => {
    const dataUrl = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(SAMPLE_SVG),
      format: "dataUrl",
      cache: false,
      size: 32,
    });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe.runIf(!hasNodeCanvas)("node integration without canvas peer", () => {
  test("reports the install hint when rasterizing without @napi-rs/canvas", async () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error test override
    delete globalThis.document;
    // @ts-expect-error test override
    delete globalThis.OffscreenCanvas;

    try {
      await expect(
        emojiToImage("😀", {
          fetch: mockTwemojiFetch(SAMPLE_SVG),
          format: "blob",
          cache: false,
        }),
      ).rejects.toThrow(NODE_CANVAS_INSTALL_HINT);
    } finally {
      globalThis.document = originalDocument;
    }
  });

  test('format: "image" requires a browser DOM', async () => {
    const originalImage = globalThis.Image;
    // @ts-expect-error test override
    delete globalThis.Image;

    try {
      await expect(
        emojiToImage("😀", {
          fetch: mockTwemojiFetch(SAMPLE_SVG),
          format: "image",
          cache: false,
        }),
      ).rejects.toBeInstanceOf(RasterizeError);
    } finally {
      globalThis.Image = originalImage;
    }
  });
});
