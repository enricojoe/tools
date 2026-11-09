# SVG Viewer (frontend)

Branch: `frontend/feature/svg-viewer`. Frontend only: the SVG is parsed and drawn in the browser, so it never leaves the page and needs no API.

## Design

- Tool at `/tools/svg-viewer` (category Design, new `vector` icon). SVG code on one side, the preview on the other, details and export under the preview.
- **Input:** paste or type SVG code, or pick, drop or paste an `.svg` file (up to 5 MB). "Try an example" fills in a sample. The code is kept on this device as a draft.
- **Safe preview:** the SVG is shown through an `<img>`, so scripts and event handlers never run and nothing external is fetched.
- **Forgiving:** a missing `xmlns` (SVG copied out of HTML) or `xmlns:xlink` is added; an `<svg>` wrapped in other markup is found and shown. Broken XML gets the parser's error with its line and column.
- **Viewer:** zoom with buttons, the mouse wheel / trackpad pinch (around the cursor) or keys (`+` `-` `0` fit, `1` 100%, arrows pan); drag to pan; Fit and 100%. Backgrounds: checkerboard, white, black or a picked color (remembered).
- **Details:** size in px (from width / height with units, or the viewBox, or the 300×150 default), the raw width / height / viewBox, file size, element count and most-used tags, the colors it uses (click to copy), and notes for scripts, event handlers, external files, bitmap images and `currentColor`.
- **Tidy up:** Format (indented) and Minify (no comments, metadata or extra whitespace), with the size saved.
- **Export:** download the `.svg`; PNG at 1×, 2×, 4× or a custom width (up to 8192 px), transparent or on the preview color; copy the code, a `data:` URL or a CSS `background-image`.
- Pure logic (parse, info, format / minify, sizing, data URL) in `svg.ts`, no React.

## Plan

- [x] `src/tools/svg-viewer/svg.ts`: parse with fixes and errors, size and info, colors, warnings, format / minify, sized copy for preview and export, data URL
- [x] `SvgViewerTool.tsx` + CSS: code input with file / drop / paste, stage with zoom / pan / backgrounds, details, export, draft storage
- [x] Icons (`vector`, `zoomIn`, `zoomOut`, `fit`); registry entry
- [x] README: SVG Viewer section, Progress
- [x] Verify: run `svg.ts` against samples (jsdom), `npm run lint`, `npm run build`, the page in the dev server

## Result

Built the SVG viewer per the design, frontend only (no API). The auto-fit on a new SVG runs during render from a ResizeObserver-measured stage size (not in an effect), keyed on the SVG's size so edits that keep the size don't reset the zoom. The preview and PNG use a copy of the SVG with a viewBox and px width / height set, so SVGs without a viewBox scale instead of being cropped.

Verification:

- `svg.ts` run with jsdom: sizes from `mm` / `pt` / `in` / unitless, width + viewBox, viewBox only and the 300 × 150 default; `%` and `auto` ignored; missing `xmlns` / `xmlns:xlink` added; `<svg>` inside a `<div>` found; colors from attributes, `style` and `<style>` with `#fff` / `#ffffff` merged; warnings for script, handlers, external href, bitmap and `currentColor`; Format keeps spacing in `<text>`, Minify drops comments and `<metadata>`; data URL encodes emoji correctly.
- `npm run lint` and `npm run build` pass.
- Driven in headless Chrome (Playwright, dev server): example renders and fits (277%), wheel zoom around the cursor, drag pan, Fit, Minify / Format notes, PNG download (240 × 240 at 2×, checked visually), SVG download, Copy as CSS on the clipboard, xmlns fix and `currentColor` notes, broken code keeps the last good preview with a "line 1, column 102" error, draft survives a reload, no horizontal scroll at 390 px, no console errors.
- Not checked: Firefox / Safari (their parser error text is handled but not seen), and two-finger pinch on touch screens (not built; one-finger drag pans, the buttons zoom).
