import { vi } from "vite-plus/test";
import { FLUENT_ASSET_BASE } from "../src/fluentMeta.ts";

export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#FFCC4D"/></svg>`;

export const FAMILY_EMOJI = "👨‍👩‍👧";
export const FAMILY_CODEPOINT = "1f468-200d-1f469-200d-1f467";
export const FAMILY_CODEPOINT_OPENMOJI = "1F468-200D-1F469-200D-1F467";
export const FAMILY_CODEPOINT_NOTO = "emoji_u1f468_200d_1f469_200d_1f467";

export const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0/assets/svg";
export const OPENMOJI_BASE = "https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg";
export const NOTO_BASE = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg";
export const FLUENT_BASE = FLUENT_ASSET_BASE;
export const FLUENT_GRINNING_COLOR = `${FLUENT_BASE}/Grinning%20face/Color/grinning_face_color.svg`;
export const FLUENT_GRINNING_FLAT = `${FLUENT_BASE}/Grinning%20face/Flat/grinning_face_flat.svg`;
export const FLUENT_GRINNING_HC = `${FLUENT_BASE}/Grinning%20face/High%20Contrast/grinning_face_high_contrast.svg`;
export const FLUENT_THUMBS_DEFAULT = `${FLUENT_BASE}/Thumbs%20up/Default/Color/thumbs_up_color_default.svg`;
export const FLUENT_THUMBS_LIGHT = `${FLUENT_BASE}/Thumbs%20up/Light/Color/thumbs_up_color_light.svg`;
export const FLUENT_THUMBS_3D = `${FLUENT_BASE}/Thumbs%20up/Default/3D/thumbs_up_3d_default.png`;
export const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
    [`${TWEMOJI_BASE}/1f600.svg`]: svg,
    [`${TWEMOJI_BASE}/${FAMILY_CODEPOINT}.svg`]: svg,
  });
}

export function mockOpenmojiFetch(svg = SAMPLE_SVG): typeof fetch {
  return createMockFetch({
    [`${OPENMOJI_BASE}/1F600.svg`]: svg,
    [`${OPENMOJI_BASE}/${FAMILY_CODEPOINT_OPENMOJI}.svg`]: svg,
  });
}

export function mockNotoFetch(svg = SAMPLE_SVG): typeof fetch {
  return createMockFetch({
    [`${NOTO_BASE}/emoji_u1f600.svg`]: svg,
    [`${NOTO_BASE}/${FAMILY_CODEPOINT_NOTO}.svg`]: svg,
  });
}

export function mockFluentFetch(svg = SAMPLE_SVG): typeof fetch {
  const pngBytes = Uint8Array.from(atob(TINY_PNG_B64), (char) => char.charCodeAt(0));

  return (async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url === FLUENT_THUMBS_3D) {
      return new Response(pngBytes, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    const responses: Record<string, string> = {
      [FLUENT_GRINNING_COLOR]: svg,
      [FLUENT_GRINNING_FLAT]: svg,
      [FLUENT_GRINNING_HC]: svg,
      [FLUENT_THUMBS_DEFAULT]: svg,
      [FLUENT_THUMBS_LIGHT]: svg,
    };

    if (url in responses) {
      return new Response(responses[url], {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;
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
