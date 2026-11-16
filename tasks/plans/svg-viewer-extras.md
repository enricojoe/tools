# SVG Viewer Extras (frontend)

Branch: `frontend/feature/svg-viewer-extras`. Frontend only, like the viewer: everything runs in the browser.

## Design

- **Modes:** a View / Compare switch at the top of the SVG viewer (remembered). View is the viewer as it is, plus the Recolor and React cards; Compare is the diff.
- **Recolor** (View, card under Details): pick one of the colors the SVG uses, pick the new one (color picker, any CSS color typed in, or `currentColor` for icons), and Replace changes every use at once: `fill` / `stroke` / `stop-color` / `flood-color` / `lighting-color` / `color` attributes, inline `style`, and `<style>` sheets. `#fff`, `#FFF` and `#ffffff` count as the same color; `!important` is kept. The code is rewritten (formatting kept), with a note saying how many uses changed and an Undo.
- **SVG → JSX** (View, card under Save or copy): a React component (or just the JSX) from the SVG. Attributes become JSX names (`class` → `className`, `stroke-width` → `strokeWidth`, `xlink:href` → `href`, `xml:space` → `xmlSpace`; `data-*` / `aria-*` kept), `style="…"` becomes a style object, `<style>` text a template literal, text is escaped for JSX. Dropped, with a note: comments, `<metadata>`, `<script>`, event handlers, and editor junk (`inkscape:*`, `sodipodi:*` and their namespaces). Options: component or JSX only, TypeScript (`SVGProps<SVGSVGElement>`), pass props through (`{...props}`), drop width / height (size with CSS; a viewBox is added if missing). The name comes from the file name in PascalCase and can be edited. Copy, or download `.jsx` / `.tsx`.
- **Compare** (two SVGs, A and B): A is the viewer's code, B has its own input (paste, file, drop) and draft. Swap, copy A into B, and an example pair.
  - Visual: Side by side (two stages, zoom and pan move together), Swipe (B over A, cut at a slider) and Difference (pixels that differ shown in red over a faded A, with the share of pixels that differ). Backgrounds as in the viewer.
  - Facts: size, viewBox, elements, file size and colors of A and B next to each other, differences marked; colors only in A or only in B listed.
  - Code: a side-by-side line diff (Myers), formatted first so only real changes show (toggle off to compare the code as typed), changed parts of a line highlighted, long unchanged runs folded and expandable, `+N −M` counts.
- Shared code: pan / zoom moves into a `usePanZoom` hook used by the viewer and Compare; file reading into `readSvgFile`. Pure logic stays React-free: recolor in `svg.ts`, `jsx.ts`, `diff.ts`.

## Plan

- [x] `svg.ts`: `recolorSvg`, `readSvgFile`; `usePanZoom.ts` hook, viewer moved onto it
- [x] `jsx.ts`: SVG → JSX / component
- [x] `diff.ts`: line diff, side-by-side rows, inline change ranges
- [x] `SvgViewerTool.tsx`: mode switch, Recolor card, React card
- [x] `SvgCompare.tsx`: A / B inputs, visual compare (side by side, swipe, difference), facts, code diff; CSS
- [x] README: SVG Viewer section, Progress; registry keywords
- [x] Verify: logic against samples (jsdom), `npm run lint`, `npm run build`, the page in headless Chrome

## Result

Built per the design, frontend only. The viewer's pan / zoom moved into `usePanZoom` (a callback ref, so several stages can share one view), and the background chips and zoom bar into `parts.tsx`, so Compare reuses them; helpers and the example live in `util.ts` (no non-component exports from `.tsx`, per the lint rule). Recolor edits a copy of the parsed DOM and serializes it, so whitespace and comments inside the SVG are kept; a prolog or markup around the `<svg>` is not.

Verification:

- Logic with jsdom (tsx): recolor counts and changes 5 uses of white across attributes, `style`, a CDATA `<style>` (kept) with `!important` and odd spacing kept, leaves `#ffff00`, `#fffa` and `stroke-width` alone, and matches the Details count; `currentColor` target. JSX: `className`, `href`, no `xmlnsXlink` unless other `xlink:*` remain (then `xlinkTitle` + `xmlnsXlink`), Inkscape attributes / script / metadata / comments / `onclick` dropped with notes, `data-*` / `aria-*` kept, style object with vendor prefix and `;` inside `url()`, `<style>` backticks and `${` escaped, braces and double spaces in text kept, viewBox added when dropping size, TS props and import, names. Diff: valid and minimal (against an LCS table) on 500 random pairs, empty inputs, 5000 lines with 100 edits, a 5000 vs 5000 unrelated pair gives up fast; rows, folding, changed range.
- `npm run lint` and `npm run build` pass.
- Driven in headless Chrome (Playwright, dev server): the viewer still renders and fits; Recolor replace / note / Undo / `currentColor` / invalid color; JSX component, JSX only, JS, no size, renamed with the name hint, `.jsx` download name, Copy; Compare side by side with shared wheel zoom, facts and only-in-B colors, `+1 −1` with marked changes, Swipe clip, Difference (20.4% differ, checked visually), identical → "look the same" and "No changes", reformatted B ignored and shown with the toggle off, folds and expanding one, Swap, mode and B kept after a reload, broken B error, example pair; no horizontal scroll at 390 px in both modes; no console errors.
- Not checked: Firefox / Safari, and dark mode by eye (colors are theme tokens or `color-mix` with them).

## UI / UX follow-up

The user found the first layout off and picked three problems: View too long, Recolor repeating the colors, Compare cluttered. Changes:

- View: two balanced columns, code + a tabbed Save card (Image & code / React) on the left, Preview + Details on the right; on phones the columns dissolve (`display: contents`) into code, preview, details, save.
- Recolor moved into Details: clicking a color opens an editor under the colors (new color, `currentColor`, Replace, Copy, close); the result and Undo show there too. No separate card.
- Compare: view mode and background share one toolbar row; the A / B table card became a strip of chips under the view (same facts muted, changes as `A → B`, colors only in A struck through → only in B); the code diff is folded behind its `+N −M` header (remembered).
- Verified again: lint, type check, the full Playwright run (updated for the new interactions) passes, cards in the right visual order at 390 px with no horizontal scroll, screenshots checked.

## Redesign: artboard studio

The follow-up still felt "meh"; the user asked for something more creative and picked the artboard studio direction from three concepts (with previews).

- Files: `SvgViewerTool.tsx` is now a thin shell (code, name, options, mode switch); `Studio.tsx` and `SvgCompare.tsx` are the two modes; `parts.tsx` holds the docks, code editor, drawer and toast; `options.ts` the remembered choices (old `view` / `compare` modes migrate); `useToast.ts`; `util.ts` gained `useWindowPaste` and `copyText`; `usePanZoom` takes a fit padding for the docks. New `code` and `atom` icons. Logic modules unchanged.
- Studio: hero board with floating zoom / background docks and a taped file name; paint-pot tray (hover spotlights the color in pink, click opens the mixer with a live try-out, Repaint commits with Undo in a toast); info chips and a notes sticker; export stickers with a PNG options popover; a code / React drawer beside the board (below it under 1100 px); paste anywhere; drop on the board.
- A vs B: contender cards with thumbnails and drop targets, a VS badge that swaps, one board with a view dock (Swipe default with a draggable / keyboard handle, Side by side, Difference with a verdict sticker), what-differs chips, the folded code diff, A / B code drawer.
- Found and fixed while testing: two buttons both named "Code" (the copy sticker is now "Copy code"); dock tabs lost their accessible names when a container query hid the labels (now `aria-label`); docks under the swipe line; the verdict and zoom dock colliding on phones; the diff wrapping into slivers on phones (wider columns that scroll sideways).
- Verified: lint, type check, build; a new Playwright run (`ui2.mjs`) covering paste anywhere, example, spotlight, live mixer, repaint / undo / `currentColor` / invalid / Esc, Minify undo, PNG download and options popover, data URL copy, SVG download, React rename / download / copy, broken code alert, A vs B copy / edit, dragging and keying the swipe handle, delta chips, folded diff, side by side shared zoom, Difference verdict, VS swap, paste into the edited side, persistence, old options migration, no horizontal scroll at 390 px, no console errors; screenshots checked on desktop and phone.
- Not checked: Firefox / Safari, dark mode by eye, real touch devices.
