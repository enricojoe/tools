# Casual look + light/dark toggle (frontend)

Branch: `frontend/feature/tools-hub-ui` (builds on the uncommitted hub UI).

## Plan

- [x] Blue (main) and red (highlight) palette on cool neutrals, navy in dark mode, rounded font (Nunito), bigger radii, pill buttons
- [x] Friendlier copy: hero, search, empty states, QR tool, 404
- [x] Theme toggle: `data-theme` on `<html>`, saved in `localStorage`, defaults to the system preference; inline script in `index.html` prevents a flash of the wrong theme
- [x] Toggle in the sidebar header (desktop) and top bar (mobile)
- [x] Check text/accent contrast (WCAG AA) in both themes
- [x] Update README progress
- [x] Verify: lint, build, browser check in both themes and both widths

## Result

- `npm run lint` and `npm run build` pass. All text/accent pairs pass WCAG AA (lowest: accent on soft tile 4.59:1 light).
- Headless Chromium against the real backend: defaults follow the system theme (light at 1280px, dark at 390px), sidebar and top-bar toggles flip `data-theme` and the button label, the choice survives a reload, QR generation works, no console errors.
- Palette switched to blue + red at the user's request: blue `--accent` for actions/links/selection, red `--highlight` for logo, greeting, theme toggle and icon accents. All pairs pass AA (lowest: red on light bg 4.54:1). Re-verified in the browser in both themes.

## Creative pass (user: "be more creative")

- [x] Sticker style: bold outlines + solid offset shadows that alternate blue/red, press-down on click
- [x] Dotted paper background; gradient logo tile with red dot
- [x] Hero: hand-drawn doodles (ring, star, squiggle, plus) floating on the right, red scribble under "making", waving hand
- [x] Tool cards alternate blue/red; tool header icon as a tilted sticker
- [x] QR result pops in with a slight tilt; 404 with outlined, shadowed number
- [x] Respect `prefers-reduced-motion`; recheck contrast and both themes
- Creative pass verified: lint + build clean, no horizontal overflow at 390px (home and QR result), theme toggle/persistence re-checked, no console errors. Fixed along the way: mobile top bar stretching on short pages (`grid-template-rows: auto 1fr`), QR image padding kept outside the image so modules stay crisp, badge/icon text uses `--on-accent` for dark-mode contrast.
