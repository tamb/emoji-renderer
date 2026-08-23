import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { emojiToSvg } from "../src/emojiToSvg.ts";
import { EmojiNotFoundError } from "../src/errors.ts";
import {
  buildFluentAssetUrl,
  FLUENT_ASSET_BASE,
  folderToFileStem,
  isFluentSource,
  lookupFluentEntry,
} from "../src/fluent.ts";
import { buildAssetUrl, resolveSourceConfig } from "../src/sources.ts";
import { sharedSvgCache } from "../src/svgCache.ts";
import {
  FAMILY_EMOJI,
  FLUENT_GRINNING_COLOR,
  FLUENT_GRINNING_FLAT,
  FLUENT_GRINNING_HC,
  FLUENT_THUMBS_3D,
  FLUENT_THUMBS_DEFAULT,
  FLUENT_THUMBS_LIGHT,
  mockFluentFetch,
} from "./helpers.ts";

describe("Fluent source mapping", () => {
  test("isFluentSource detects the preset string and object", () => {
    expect(isFluentSource("fluent")).toBe(true);
    expect(isFluentSource({ preset: "fluent", style: "flat" })).toBe(true);
    expect(isFluentSource("twemoji")).toBe(false);
    expect(isFluentSource({ baseUrl: "https://example.com" })).toBe(false);
  });

  test("maps singles, skin tones, ZWJ, and FE0F variants", () => {
    expect(lookupFluentEntry("1f600")).toBe("Grinning face");
    expect(lookupFluentEntry("1f44d")).toEqual(["Thumbs up", "Default"]);
    expect(lookupFluentEntry("1f44d-1f3fb")).toEqual(["Thumbs up", "Light"]);
    expect(lookupFluentEntry("1f468-200d-1f9b0")).toEqual(["Man red hair", "Default"]);
    expect(lookupFluentEntry("1f468-1f3fb-200d-1f9bd-200d-27a1")).toEqual([
      "Man in manual wheelchair facing right",
      "Light",
    ]);
    expect(lookupFluentEntry("263a-fe0f")).toBe("Smiling face");
    expect(lookupFluentEntry("263a")).toBe("Smiling face");
    expect(lookupFluentEntry("1f468-200d-1f469-200d-1f467")).toBeUndefined();
  });

  test("builds pinned jsDelivr URLs for color, flat, high-contrast, and 3d", () => {
    expect(buildFluentAssetUrl("1f600", "fluent")).toBe(FLUENT_GRINNING_COLOR);
    expect(buildFluentAssetUrl("1f600", { preset: "fluent", style: "flat" })).toBe(
      FLUENT_GRINNING_FLAT,
    );
    expect(buildFluentAssetUrl("1f600", { preset: "fluent", style: "high-contrast" })).toBe(
      FLUENT_GRINNING_HC,
    );
    expect(buildFluentAssetUrl("1f44d", { preset: "fluent", style: "3d" })).toBe(FLUENT_THUMBS_3D);
    expect(buildFluentAssetUrl("1f44d", "fluent")).toBe(FLUENT_THUMBS_DEFAULT);
    expect(buildFluentAssetUrl("1f44d-1f3fb", "fluent")).toBe(FLUENT_THUMBS_LIGHT);
  });

  test("buildAssetUrl rejects Fluent sources synchronously", () => {
    expect(() => buildAssetUrl("1f600", "fluent")).toThrow(/does not resolve Fluent sources/);
  });

  test("uses a custom Fluent asset root", () => {
    expect(
      buildFluentAssetUrl("1f600", {
        preset: "fluent",
        baseUrl: "https://cdn.example.com/fluent/",
      }),
    ).toBe("https://cdn.example.com/fluent/Grinning%20face/Color/grinning_face_color.svg");
  });

  test("throws EmojiNotFoundError for unmapped emoji and high-contrast skin tones", () => {
    expect(() => buildFluentAssetUrl("1f468-200d-1f469-200d-1f467", "fluent")).toThrow(
      EmojiNotFoundError,
    );
    expect(() =>
      buildFluentAssetUrl("1f44d-1f3fb", { preset: "fluent", style: "high-contrast" }),
    ).toThrow(EmojiNotFoundError);
  });

  test("does not expose Fluent through resolveSourceConfig", () => {
    expect(() => resolveSourceConfig("fluent")).toThrow(/codepoint filename stems/);
  });

  test("folderToFileStem strips punctuation", () => {
    expect(folderToFileStem("Grinning face")).toBe("grinning_face");
    expect(folderToFileStem("Man in manual wheelchair facing right")).toBe(
      "man_in_manual_wheelchair_facing_right",
    );
  });
});

describe("Fluent fetch", () => {
  beforeEach(() => {
    sharedSvgCache.clear();
  });

  test("emojiToSvg fetches the default color preset", async () => {
    const fetchImpl = vi.fn(mockFluentFetch());
    const svg = await emojiToSvg("😀", { source: "fluent", fetch: fetchImpl, size: 48 });

    expect(fetchImpl).toHaveBeenCalledWith(FLUENT_GRINNING_COLOR, expect.any(Object));
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="48"');
  });

  test("emojiToSvg fetches flat, high-contrast, skin-tone, and 3d assets", async () => {
    const fetchImpl = vi.fn(mockFluentFetch());

    await emojiToSvg("😀", { source: { preset: "fluent", style: "flat" }, fetch: fetchImpl });
    await emojiToSvg("😀", {
      source: { preset: "fluent", style: "high-contrast" },
      fetch: fetchImpl,
    });
    await emojiToSvg("👍🏻", { source: "fluent", fetch: fetchImpl });
    const threeD = await emojiToSvg("👍", {
      source: { preset: "fluent", style: "3d" },
      fetch: fetchImpl,
      size: 32,
    });

    expect(fetchImpl).toHaveBeenCalledWith(FLUENT_GRINNING_FLAT, expect.any(Object));
    expect(fetchImpl).toHaveBeenCalledWith(FLUENT_GRINNING_HC, expect.any(Object));
    expect(fetchImpl).toHaveBeenCalledWith(FLUENT_THUMBS_LIGHT, expect.any(Object));
    expect(fetchImpl).toHaveBeenCalledWith(FLUENT_THUMBS_3D, expect.any(Object));
    expect(threeD).toContain("<image");
    expect(threeD).toContain("data:image/png");
  });

  test("throws EmojiNotFoundError with the original emoji for unmapped Fluent glyphs", async () => {
    await expect(
      emojiToSvg(FAMILY_EMOJI, { source: "fluent", fetch: mockFluentFetch() }),
    ).rejects.toMatchObject({
      name: "EmojiNotFoundError",
      emoji: FAMILY_EMOJI,
    });
  });

  test("pins Fluent assets to a jsDelivr commit", () => {
    expect(FLUENT_ASSET_BASE).toMatch(/fluentui-emoji@[0-9a-f]{7,}/);
  });
});
