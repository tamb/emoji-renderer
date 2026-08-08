import { describe, expect, test } from "vite-plus/test";
import { wrapRasterSvg } from "../src/wrapRasterSvg.ts";

describe("wrapRasterSvg", () => {
  test("wraps a data URL in an SVG image element", () => {
    const svg = wrapRasterSvg({
      dataUrl: "data:image/png;base64,abc",
      size: 48,
    });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="48"');
    expect(svg).toContain('href="data:image/png;base64,abc"');
    expect(svg).not.toContain("<?xml");
  });

  test("can include an XML declaration", () => {
    const svg = wrapRasterSvg({
      dataUrl: "data:image/png;base64,abc",
      size: 48,
      xmlDeclaration: true,
    });

    expect(svg.startsWith("<?xml")).toBe(true);
  });
});
