# Plan: Fluent Emoji source support

Status: planned (not implemented). Track follow-up work for adding Microsoft [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) as a first-class `source` preset alongside `native`, `twemoji`, `openmoji`, and `noto`.

## Why defer

Fluent assets are MIT-licensed and free to use, but they do **not** ship as a simple codepoint → single SVG CDN tree the way Twemoji / OpenMoji / Noto do.

- Assets are organized by **friendly name** and **style** (`3D`, `Color`, `Flat`, `High Contrast`), not primarily by Unicode codepoint filenames.
- Many glyphs are **PNG** (especially 3D); Flat/Color SVG coverage differs by emoji.
- ZWJ sequences, skin tones, and directional variants need a **metadata map** from codepoint → asset folder/file.
- There is no single official jsDelivr path like `…/svg/{codepoint}.svg` that covers the full set uniformly.

Shipping a half-wired `"fluent"` preset would either break often or force a large metadata dependency into the core package.

## Goals

1. Add `source: "fluent"` (and optional style variants) for `emojiToSvg` / `emojiToImage`.
2. Keep tree-shaking and zero-config CDN presets for existing sources.
3. Avoid bloating the default bundle with Fluent’s full name map unless the consumer opts in.
4. Document attribution (MIT) and which style is the default.

## Proposed API

```ts
type FluentStyle = "flat" | "color" | "high-contrast" | "3d";

type EmojiSource =
  | "twemoji"
  | "openmoji"
  | "noto"
  | "fluent" // default style: "flat" or "color" — decide during implementation
  | {
      baseUrl: string;
      ext?: string;
      codePointFormat?: CodePointFormat | "fluent";
    }
  | {
      preset: "fluent";
      style?: FluentStyle;
      // optional override CDN / mirror
      baseUrl?: string;
    };
```

Image path stays compatible: `"native" | EmojiSource`.

## Implementation outline

### 1. Metadata strategy

Pick one approach (prefer A unless package size becomes a problem):

- **A. Lazy JSON map** (recommended first cut)
  - Ship or fetch a compact `codepoint → fluent folder/name` map (generated from Fluent’s `metadata.json` / folder layout).
  - Load only when `source` resolves to Fluent so Twemoji/OpenMoji/Noto/native paths stay unchanged.
- **B. Optional subpath export**
  - `emoji-renderer/fluent` that pulls in the map + URL builder.
  - Core `source: "fluent"` re-exports or documents importing the subpath.
- **C. External map injection**
  - `source: { preset: "fluent", resolve: (codePoint) => url }` for advanced users; built-in map later.

Generate the map in a small build script under `scripts/generate-fluent-map.ts` so Unicode updates are mechanical.

### 2. URL resolution

- Resolve emoji → Twemoji-style codepoint (existing `emojiToCodePoint`).
- Map codepoint → Fluent asset id/path.
- Build URL for the chosen style, e.g. pinned GitHub/jsDelivr release of `microsoft/fluentui-emoji`.
- Decide fallback when Flat SVG is missing but Color/3D PNG exists:
  - Prefer SVG for `emojiToSvg`; for missing SVG, either throw `EmojiNotFoundError` or allow PNG-in-SVG wrapper (reuse pixelate/raster path carefully).

### 3. Style defaults

Recommended defaults to validate in a spike:

| API            | Default style                                         | Reason                         |
| -------------- | ----------------------------------------------------- | ------------------------------ |
| `emojiToSvg`   | `flat` or `color` SVG                                 | Must be vector/markup-friendly |
| `emojiToImage` | same as SVG, or `3d` PNG only if explicitly requested | Keep SVG→canvas path simple    |

Do **not** default `emojiToImage` to Fluent; keep `"native"` as the library image default.

### 4. Packaging / CDN pinning

- Pin a Fluent release tag (not `@main`).
- Prefer official `microsoft/fluentui-emoji` over third-party mirrors.
- Document that consumers may host assets themselves via `{ baseUrl }` once `codePointFormat: "fluent"` (or the preset object) exists.
- Consider CORS and jsDelivr path length limits for deeply nested folders.

### 5. Tests

- Unit: codepoint → Fluent path for singles, ZWJ, skin tones, flags.
- Unit: missing asset → `EmojiNotFoundError`.
- Browser e2e: fetch one Flat SVG and one Color SVG from the pinned CDN.
- Storybook: add `fluent` (+ style control) next to other presets.
- Contract: no Fluent metadata in the default entry chunk unless opted in (bundle size assertion if feasible).

### 6. Docs / attribution

- README sources table row for Fluent (MIT).
- Note style differences vs Twemoji/OpenMoji/Noto.
- Link to Fluent repo and required attribution text if any beyond MIT notice.

## Spike checklist (before coding the preset)

- [ ] Confirm Flat vs Color SVG coverage % for current Unicode emoji used in our tests.
- [ ] Measure generated map size (raw JSON vs gzipped).
- [ ] Verify jsDelivr URLs for a ZWJ family emoji and a skin-tone emoji.
- [ ] Decide SVG-only vs PNG fallback behavior for `emojiToSvg`.
- [ ] Choose default Fluent style.

## Non-goals (for the first Fluent PR)

- Bundling full Fluent binary assets into npm.
- Replacing native/Twemoji defaults.
- Supporting animated or 3D-only pipelines beyond static PNG rasterization.
- Perfect glyph parity with every OS native emoji.

## Done when

- `source: "fluent"` works for common emoji in Storybook and e2e.
- Map is generated/pinned and documented.
- Default image source remains `"native"`; SVG default remains `"twemoji"` (unless a later deliberate change).
- Bundle impact for non-Fluent users is negligible (lazy or subpath).
