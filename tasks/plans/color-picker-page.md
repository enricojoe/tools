# Color Picker (frontend)

Branch: `frontend/feature/color-picker`. Uses `GET /api/colors?hex=` from the backend branch built in parallel (the client codes to the agreed contract).

## Design

- Tool at `/tools/color-picker` (category Design). A saturation/brightness square and a hue slider (pointer and keyboard: arrows, Shift for bigger steps), a validated hex input, and a "Pick from screen" button when the browser has the `EyeDropper` API (hidden otherwise).
- Picking is local and instant: HSV, RGB and hex math lives in `color.ts`. The picker keeps HSV as its state so the hue doesn't jump on greys.
- The info panel comes from the API, debounced 200 ms with stale requests aborted: name ("≈" when not an exact match), HEX/RGB/HSL/HSV/CMYK with copy buttons, contrast against white and black with WCAG AA/AAA badges, a text sample, shades and harmonies as clickable swatches.
- If the API fails the picker keeps working; the panel shows an error with "Try again". The last good result stays visible (dimmed) while a new one loads.
- Saved colors: save, load, remove; kept in `localStorage` (try/catch, validated on load, max 24).

## Plan

- [x] `src/api/colors.ts`: typed client with response validation
- [x] `src/tools/color-picker/`: `color.ts`, `useColorInfo.ts`, `Picker.tsx`, `InfoPanel.tsx`, `SwatchRow.tsx`, `SavedColors.tsx`, `ColorPickerTool.tsx` + CSS
- [x] `palette`, `eyedropper` icons; registry entry
- [x] README: Color Picker section, Feature List
- [x] Verify: build, lint

## Result

Built the Color Picker tool per the design.

Verification:

- `npm run build` and `npm run lint` pass.
- Not driven against a running backend (it is built in parallel on its own branch).
