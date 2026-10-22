# Multi-tool hub UI (frontend)

Branch: `frontend/feature/tools-hub-ui`. Turn the single QR page into a hub that hosts many tools, with QR as the first one.

## Plan

- [x] Add `react-router` for client-side routes (`/` home, `/tools/:slug` per tool, 404)
- [x] Tool registry `src/tools/registry.ts`: one entry per tool (slug, name, description, category, icon, page component) so a new tool is one entry + one page
- [x] App shell `src/layout/AppLayout.tsx`: sidebar with brand, tool search and tool links (grouped by category); mobile top bar with a drawer
- [x] Home page: intro + searchable grid of tool cards
- [x] Tool page wrapper: title, description, consistent header
- [x] Move QR page into `src/tools/qr/` (form + preview side by side on wide screens)
- [x] 404 page
- [x] Refresh design tokens and styles (light/dark, focus-visible, responsive)
- [x] Update README (stack, structure, progress)
- [x] Verify: lint, build, and click through in the dev server against the real backend

## Result

- `npm run lint` and `npm run build` pass; each tool is code-split (`QRTool` is its own chunk).
- Verified with headless Chromium against the real backend on :8080 via the Vite proxy, at 1280px (light) and 390px (dark):
  home renders, search filters and shows an empty state, card opens `/tools/qr-code`, QR generates and "Download PNG" appears,
  page titles update per route, `/` focuses sidebar search, mobile drawer opens and closes after navigating, `/tools/nope` shows 404. No console errors.
- Closing the drawer on navigation is done from the link click (not an effect), per the `react(set-state-in-effect)` lint rule.
