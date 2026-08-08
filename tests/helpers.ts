import { vi } from "vite-plus/test";

export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#FFCC4D"/></svg>`;

export const FAMILY_EMOJI = "👨‍👩‍👧";
export const FAMILY_CODEPOINT = "1f468-200d-1f469-200d-1f467";

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export function createMockFetch(responses: Record<string, string | number> = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    const response = responses[url];

    if (typeof response === "number") {
      return new Response(null, { status: response });
    }

    if (typeof response === "string") {
      return new Response(response, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;
}

export function mockTwemojiFetch(svg = SAMPLE_SVG): typeof fetch {
  return createMockFetch({
    [`https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg/1f600.svg`]: svg,
    [`https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg/${FAMILY_CODEPOINT}.svg`]: svg,
  });
}

export function mockCanvas(): () => void {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  // happy-dom exposes OffscreenCanvas without a working 2D context.
  // @ts-expect-error test override
  delete globalThis.OffscreenCanvas;

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    font: "",
    textAlign: "",
    textBaseline: "",
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["png"], { type: "image/png" }));
  });

  const ImageMock = function ImageMock(this: unknown) {
    const image = document.createElement("img");
    queueMicrotask(() => {
      image.dispatchEvent(new Event("load"));
    });
    return image;
  } as unknown as typeof Image;

  vi.spyOn(globalThis, "Image").mockImplementation(ImageMock);

  return () => {
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  };
}
