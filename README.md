# emoji-renderer

Convert emoji to SVG markup or raster images with lazy-loaded [Twemoji](https://github.com/jdecked/twemoji) assets.

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
const native = await emojiToImage("😀", { source: "native", size: 48 });
const responsiveSvg = await emojiToSvg("😀", { responsive: true });
const responsiveImg = await emojiToImage("😀", { size: 48, responsive: true });
const srcsetImg = await emojiToImage("😀", {
  size: 48,
  srcSet: [24, 48, 96],
  sizes: "(max-width: 600px) 24px, 48px",
  responsive: true,
});
```

## Options

| Option           | Applies to     | Default            | Description                                        |
| ---------------- | -------------- | ------------------ | -------------------------------------------------- |
| `size`           | both           | `72`               | Width and height in pixels                         |
| `source`         | both*          | `"twemoji"`        | `"twemoji"`, `"native"`*, or `{ baseUrl, ext? }`   |
| `fetch`          | both           | `globalThis.fetch` | Custom fetch implementation                        |
| `cache`          | both           | `true`             | Cache fetched SVG text in memory                   |
| `signal`         | both           | —                  | `AbortSignal` for fetch                            |
| `xmlDeclaration` | `emojiToSvg`   | `false`            | Prefix SVG with `<?xml ...?>`                      |
| `pixelate`       | both           | off                | Block size in px; `>= 2` pixelates                 |
| `format`         | `emojiToImage` | `"image"`          | `"image"`, `"blob"`, or `"dataUrl"`                |
| `mimeType`       | `emojiToImage` | `"image/png"`      | `"image/png"` or `"image/webp"`                    |
| `background`     | `emojiToImage` | `null`             | Canvas fill color before drawing                   |
| `fontFamily`     | `emojiToImage` | emoji font stack   | Font stack when `source` is `"native"`             |
| `responsive`     | both*          | off                | CSS-scalable SVG or retina raster display          |
| `srcSet`         | `emojiToImage` | off                | Logical widths for `<img srcset>` (`format` image) |
| `sizes`          | `emojiToImage` | —                  | Optional `<img sizes>` when `srcSet` is set        |

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

Emoji artwork is provided by [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0).

## License

MIT
