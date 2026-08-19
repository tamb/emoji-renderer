# emoji-renderer

Convert emoji to SVG markup or raster images. Images default to the platform emoji font; SVG defaults to lazy-loaded [Twemoji](https://github.com/jdecked/twemoji) assets. [OpenMoji](https://openmoji.org/) and [Noto Emoji](https://github.com/googlefonts/noto-emoji) CDN presets are also built in.

## Install

```bash
npm install emoji-renderer
```

## Usage

```ts
import { emojiToSvg, emojiToImage } from "emoji-renderer";

const svg = await emojiToSvg("😀", { size: 48 });
const pixelSvg = await emojiToSvg("👾", { size: 96, pixelate: 8 });
document.querySelector("#target")!.innerHTML = svg;

// Defaults to native system emoji (no CDN fetch)
const image = await emojiToImage("🎉", { size: 48 });
document.body.append(image);
```

### Tree-shakable imports

Import only what you need:

```ts
import { emojiToSvg } from "emoji-renderer/emojiToSvg";
import { emojiToImage } from "emoji-renderer/emojiToImage";
```

### Image output formats

`emojiToImage` defaults to an `HTMLImageElement`. Use `format` for other outputs:

```ts
const blob = await emojiToImage("😀", { format: "blob" });
const dataUrl = await emojiToImage("😀", { format: "dataUrl" });
const pixel = await emojiToImage("👾", { size: 96, pixelate: 8 });
const twemoji = await emojiToImage("😀", { source: "twemoji", size: 48 });
const openmoji = await emojiToImage("😀", { source: "openmoji", size: 48 });
const noto = await emojiToImage("😀", { source: "noto", size: 48 });
const responsiveSvg = await emojiToSvg("😀", { responsive: true });
const responsiveImg = await emojiToImage("😀", { size: 48, responsive: true });
const srcsetImg = await emojiToImage("😀", {
  size: 48,
  srcSet: [24, 48, 96],
  sizes: "(max-width: 600px) 24px, 48px",
  responsive: true,
});
```

### Sources

| Source                                | Applies to     | License notes     | Filename style         |
| ------------------------------------- | -------------- | ----------------- | ---------------------- |
| `"native"` (image default)            | `emojiToImage` | n/a               | system font via canvas |
| `"twemoji"` (SVG default)             | both           | CC BY 4.0         | `1f600.svg`            |
| `"openmoji"`                          | both           | CC BY-SA 4.0      | `1F600.svg`            |
| `"noto"`                              | both           | Apache 2.0 / OFL  | `emoji_u1f600.svg`     |
| `{ baseUrl, ext?, codePointFormat? }` | both           | depends on assets | custom                 |

```ts
const svg = await emojiToSvg("😀", { source: "openmoji" });
const custom = await emojiToSvg("😀", {
  source: {
    baseUrl: "https://example.com/emoji",
    ext: ".svg",
    codePointFormat: "openmoji",
  },
});
```

## Options

| Option           | Applies to     | Default                             | Description                                                        |
| ---------------- | -------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `size`           | both           | `72`                                | Width and height in pixels                                         |
| `source`         | both*          | image: `"native"`; SVG: `"twemoji"` | `"native"`*, CDN presets, or `{ baseUrl, ext?, codePointFormat? }` |
| `fetch`          | both           | `globalThis.fetch`                  | Custom fetch implementation                                        |
| `cache`          | both           | `true`                              | Cache fetched SVG text in memory                                   |
| `signal`         | both           | —                                   | `AbortSignal` for fetch                                            |
| `xmlDeclaration` | `emojiToSvg`   | `false`                             | Prefix SVG with `<?xml ...?>`                                      |
| `pixelate`       | both           | off                                 | Block size in px; `>= 2` pixelates                                 |
| `format`         | `emojiToImage` | `"image"`                           | `"image"`, `"blob"`, or `"dataUrl"`                                |
| `mimeType`       | `emojiToImage` | `"image/png"`                       | `"image/png"` or `"image/webp"`                                    |
| `background`     | `emojiToImage` | `null`                              | Canvas fill color before drawing                                   |
| `fontFamily`     | `emojiToImage` | emoji font stack                    | Font stack when `source` is `"native"`                             |
| `responsive`     | both*          | off                                 | CSS-scalable SVG or retina raster display                          |
| `srcSet`         | `emojiToImage` | off                                 | Logical widths for `<img srcset>` (`format` image)                 |
| `sizes`          | `emojiToImage` | —                                   | Optional `<img sizes>` when `srcSet` is set                        |

\* `"native"` applies to `emojiToImage` only. It draws the platform emoji font via canvas (no CDN fetch). Appearance varies by OS/browser.

### Responsive output

**SVG (true vector scaling):**

```ts
const svg = await emojiToSvg("😀", { responsive: true });
// viewBox only — size with CSS: width: 2rem; height: auto;

const emSized = await emojiToSvg("😀", {
  responsive: { mode: "relative", width: "1.2em", height: "1.2em" },
});
```

**Raster (retina + CSS display, or srcset):**

```ts
const img = await emojiToImage("😀", { size: 48, responsive: true });

const srcsetImg = await emojiToImage("😀", {
  size: 48,
  srcSet: [24, 48, 96],
  sizes: "(max-width: 600px) 24px, 48px",
  responsive: { dpr: "auto", display: "css" },
});
```

`responsive` is incompatible with `pixelate` on `emojiToSvg`. `srcSet` requires `format: "image"`.

## Browser vs Node

This library is browser-first. SVG fetching works anywhere `fetch` is available. Rasterization requires a DOM with canvas support (`document`, `Image`, `canvas` or `OffscreenCanvas`).

For Node.js tests or scripts, use a DOM implementation such as `happy-dom` or `jsdom`.

## Development

```bash
npm install
npm test
npm run test:browser
npm run build
npm run check
npm run build-storybook
```

Open `demo/index.html` with a local dev server to try conversions interactively, or run Storybook:

```bash
npm run storybook
```

## Attribution

When you use CDN artwork, attribute the upstream project:

- [Twemoji](https://github.com/jdecked/twemoji) (CC BY 4.0)
- [OpenMoji](https://openmoji.org/) (CC BY-SA 4.0)
- [Noto Emoji](https://github.com/googlefonts/noto-emoji) (Apache 2.0 / OFL)

Native rendering uses the host platform’s emoji font and needs no artwork attribution from this package.

## License

MIT
