import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { nativeEmojiToImageBlob } from "../src/nativeToImage.ts";
import { mockCanvas } from "./helpers.ts";

describe("nativeToImage", () => {
  let restoreOffscreenCanvas: (() => void) | undefined;

  afterEach(() => {
    restoreOffscreenCanvas?.();
    restoreOffscreenCanvas = undefined;
    vi.restoreAllMocks();
  });

  test("draws emoji text centered on canvas", async () => {
    restoreOffscreenCanvas = mockCanvas();
    const fillText = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText,
      font: "",
      textAlign: "",
      textBaseline: "",
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);

    await nativeEmojiToImageBlob({ emoji: "🎉", size: 48, fontFamily: "Test Emoji" });

    expect(fillText).toHaveBeenCalledWith("🎉", 24, 24);
  });
});
