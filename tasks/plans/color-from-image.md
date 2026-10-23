# Color Picker: pick from an image (frontend)

Branch: `frontend/feature/color-from-image`. Frontend only: the image never leaves the browser.

## Design

- New "From an image" card on `/tools/color-picker`, between the picker and the info panel.
- Load an image by clicking, dropping it on the card, or pasting it (Ctrl/Cmd+V). Any `image/*` the browser can decode, up to 20 MB. Big images are scaled down to 1200 px on the long side for sampling.
- The image is drawn on a canvas. Moving over it shows a loupe (zoomed pixels + hex); clicking or tapping picks that pixel as the current color, and a ring marks the picked spot.
- Keyboard: focus the image, move the crosshair with the arrows (Shift for 10 px steps), Enter or Space to pick.
- "Main colors": up to 6 dominant colors found by bucketing a downsampled copy of the pixels, shown as clickable swatches.
- Errors (not an image, too big, can't be decoded) show inline; the rest of the tool keeps working.

## Plan

- [x] `color.ts`: export `rgbToHex` (reused by `hsvToHex`)
- [x] `image.ts`: load and scale an image to `ImageData`, read a pixel, find main colors
- [x] `ImagePicker.tsx` + CSS; wire into `ColorPickerTool.tsx`; `image` icon
- [x] README: Color Picker section and Feature List
- [x] Verify: build, lint, run in the browser

## Result

Built per the design. The image card sits between the picker and the info panel; the canvas fills the card width (capped at 26rem tall, keeping the image's shape).

Verification:

- `npm run build` and `npm run lint` pass.
- Drove the page in headless Chrome against the running backend: the loupe shows the pixel under the cursor; clicking red/blue/green areas sets the hex to `FF0000`/`0000FF`/`00FF00`; main colors came out as those three; keyboard (arrows, Shift, Enter) picks; a non-image file shows an error; wide and tall images keep their shape; no horizontal overflow at 375 px; no console errors.
