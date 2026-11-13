# Sidebar and favicon redesign (frontend)

Branch: `frontend/feature/sidebar-favicon-redesign`. User: "improve the ui, especially for its favicon and sidebar. be creative about it".

## Plan

### Favicon + brand
- [x] Replace the stock Vite `favicon.svg` with our own: a tilted blue sticker tile with ink outline and red offset shadow, holding a white toolbox with a red latch (the outline goes deeper on dark tab bars)
- [x] `BrandMark` component with the same toolbox art for the sidebar and top bar; the lid lifts on hover
- [x] Per-tool favicon: on a tool page the tab icon becomes that tool's icon on a tile in its category color; back to the brand icon elsewhere
- [x] `theme-color` meta for light and dark

### Sidebar
- [x] Category colors: one hue per category (light + dark values, one source in the registry), used for heading dots, icon tiles and the active link's shadow
- [x] Nav links with sticker icon tiles that wiggle on hover; active link outlined with a colored offset shadow
- [x] Collapsible category groups with count + chevron, remembered in `localStorage`; all open while searching
- [x] Recent: the last 3 tools you opened, at the top (remembered on the device)
- [x] Search: Enter opens the first match, ArrowDown moves into the results, result count shown
- [x] Desktop rail mode: collapse the sidebar to icons only (remembered), with tooltips; `[` toggles it
- [x] Footer: a tip card that shuffles friendly tips, plus "N tools and counting"
- [x] Split the sidebar out of `AppLayout.tsx` into its own component
- [x] Keep: mobile drawer, `/` shortcut, Escape to close, reduced motion

### Wrap-up
- [x] README: Feature List + Progress, structure if needed
- [x] Verify: lint, build, browser check (both themes, desktop/rail/mobile, favicon swaps, persistence, contrast)

## Result

- New `public/favicon.svg` (toolbox on a tilted blue sticker tile with a red shadow), `apple-touch-icon.png` (180px, rendered from the SVG) and `theme-color` metas. `BrandMark` reuses the art in the sidebar and top bar; the handle lifts on hover.
- `useToolFavicon` swaps the tab icon to the open tool's icon on a tile in its category color. Icon path data moved to `components/iconPaths.ts` so it can be used outside React.
- Category colors live in the registry (`categoryColor`, `categoryStyle` + the `.cat` class), shared by the sidebar and the tool page header. All pairs pass WCAG AA in both themes (lowest: white on Fun red 4.83:1; count pills nudged toward the text color, lowest 5.6:1).
- `Sidebar.tsx` split out of `AppLayout.tsx`. New hooks: `useStoredState` (localStorage-backed state, written in an effect), `useMediaQuery` (rail only applies above 900px so a saved rail never breaks the mobile drawer).
- Verified: `npm run lint` and `npm run build` clean. Headless Chromium against the dev server: favicon swaps between brand and tool icons; Recent lists the last tools minus the current one; a collapsed group survives reload; search status + Enter navigates; ArrowDown/Up move through links; `[` toggles the rail and it survives reload; rail tooltip shows the tool name; dark mode in both widths; at 390px the drawer ignores the rail, has no horizontal overflow and closes after a link; no console errors.
- Fixed during verification: sidebar children shrank when content overflowed (`flex-shrink: 0`), search box overflowed its column (`minmax(0, 1fr)`), count pills under AA for three categories.

## Follow-up (user: all groups folded by default, collapse button like the reference image)

- [x] Category groups start folded (`sidebar-expanded` replaces `sidebar-collapsed` in `localStorage`); opening a tool unfolds its group so the active link stays visible
- [x] Collapse button moved from the sidebar header to a round chevron button on the sidebar's right edge, level with the logo (‹ when open, › in rail mode); rendered outside the sidebar so its scroll area can't clip it; hidden on mobile
- [x] Verified in Chromium: all groups folded on first visit, Time opens on `/tools/timer`, opened/folded groups survive reload, button centred on the edge in both widths (x 271 / 272, 75 / 76), toggles rail and `[` still works, no console errors; lint + build clean
