import { beforeAll, describe, expect, test } from "vite-plus/test";
import { emojiToImage } from "../../src/emojiToImage.ts";
import { emojiToSvg } from "../../src/emojiToSvg.ts";
import { NODE_CANVAS_INSTALL_HINT } from "../../src/canvasEnv.ts";
import { RasterizeError } from "../../src/errors.ts";
import { mockTwemojiFetch, SAMPLE_SVG } from "../helpers.ts";

let hasNodeCanvas = false;

beforeAll(async () => {
  // Dynamic imports keep native peers out of the static module graph scanned by other
  // Vitest projects (unit runs in happy-dom and shares the same config root).
  hasNodeCanvas =
    (await import(/* @vite-ignore */ "@napi-rs/canvas").then(() => true).catch(() => false)) &&
    (await import(/* @vite-ignore */ "@resvg/resvg-js").then(() => true).catch(() => false));
});

describe("node integration", () => {
  test("fetches SVG with mock fetch in Node", async () => {
    const svg = await emojiToSvg("😀", {
      fetch: mockTwemojiFetch(SAMPLE_SVG),
      cache: false,
      size: 48,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('width="48"');
  });

  test("rasterizes to a blob with optional Node canvas peers", async () => {
    if (!hasNodeCanvas) {
      return;
    }

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
    if (!hasNodeCanvas) {
      return;
    }

    const dataUrl = await emojiToImage("😀", {
      fetch: mockTwemojiFetch(SAMPLE_SVG),
      format: "dataUrl",
      cache: false,
      size: 32,
    });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("reports the install hint when rasterizing without Node canvas peers", async () => {
    if (hasNodeCanvas) {
      return;
    }

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
