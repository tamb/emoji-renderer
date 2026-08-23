# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Noto CDN preset pinned to `v2.051` (Unicode 17.0), up from `v2.047`.

### Fixed

- Text-default emoji with VS16 (coffin, keycaps, etc.) resolve to VS16-stripped CDN filenames instead of 404ing on `-fe0f` paths.

## [1.0.0] - 2026-08-23

### Added

- `EmojiFetchError` for transient CDN/network failures (429, 5xx, timeouts), distinct from `EmojiNotFoundError` (404/410 and unmapped glyphs).
- `timeout` (default 8000 ms) and `retries` (default 2) options on fetch-based APIs.
- Optional Node.js rasterization via peer dependencies `@napi-rs/canvas` and `@resvg/resvg-js` (`format: "blob"` / `"dataUrl"`).
- Lazy-loaded Fluent emoji map so Twemoji/OpenMoji/Noto paths do not pay the ~176 KB lookup cost until `source: "fluent"` is used.
- `buildAssetUrlAsync` for async Fluent URL resolution.
- `CHANGELOG.md` and expanded production guidance in the README.

### Changed

- **Breaking:** `buildAssetUrl(..., "fluent")` no longer resolves Fluent URLs synchronously. Use `emojiToSvg` / `emojiToImage` with `source: "fluent"`, or `buildFluentAssetUrl` / `buildAssetUrlAsync`.
- Documented and frozen 1.0 defaults: both APIs default to `"twemoji"`.
- ESM-only package contract (`"type": "module"`, import-only `exports`). Node.js 22+ required.

### Fixed

- HTTP 429/5xx responses no longer masquerade as missing emoji assets.
- README usage example no longer recommends assigning untrusted SVG via `innerHTML`.
