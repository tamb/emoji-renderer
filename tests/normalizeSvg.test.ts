import { describe, expect, test } from "vite-plus/test";
import { normalizeSvg } from "../src/normalizeSvg.ts";
import { SAMPLE_SVG } from "./helpers.ts";

describe("normalizeSvg", () => {
  test("applies width and height while preserving viewBox", () => {
    const svg = normalizeSvg({ svg: SAMPLE_SVG, size: 40 });
    expect(svg).toContain('width="40"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain('viewBox="0 0 36 36"');
  });

  test("strips an existing XML declaration by default", () => {
    const svg = normalizeSvg({
      svg: `<?xml version="1.0"?>\n${SAMPLE_SVG}`,
    });
    expect(svg.startsWith("<?xml")).toBe(false);
    expect(svg).toContain("<svg");
  });

  test("keeps an existing XML declaration when requested", () => {
    const input = `<?xml version="1.0"?>\n${SAMPLE_SVG}`;
    const svg = normalizeSvg({ svg: input, xmlDeclaration: true });
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain('width="72"');
  });

  test("adds an XML declaration when missing and requested", () => {
    const svg = normalizeSvg({ svg: SAMPLE_SVG, xmlDeclaration: true });
    expect(svg.startsWith("<?xml version=")).toBe(true);
  });

  test("omits width and height when responsive is intrinsic", () => {
    const svg = normalizeSvg({ svg: SAMPLE_SVG, responsive: true });
    expect(svg).toContain('viewBox="0 0 36 36"');
    expect(svg).not.toMatch(/\swidth="/);
    expect(svg).not.toMatch(/\sheight="/);
  });

  test("applies relative CSS lengths when responsive mode is relative", () => {
    const svg = normalizeSvg({
      svg: SAMPLE_SVG,
      responsive: { mode: "relative", width: "1.2em", height: "1.2em" },
    });

    expect(svg).toContain('width="1.2em"');
    expect(svg).toContain('height="1.2em"');
    expect(svg).toContain('viewBox="0 0 36 36"');
  });

  test("applies fill dimensions when responsive mode is fill", () => {
    const svg = normalizeSvg({
      svg: SAMPLE_SVG,
      responsive: { mode: "fill" },
    });

    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="100%"');
  });
});
