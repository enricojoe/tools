# Unit converter: more playful UI

Branch: `frontend/feature/unit-converter-playful-ui`. Frontend only; the API stays the same.

## Steps

- [x] Category picker: sticker tiles with an icon per category (new icons in `Icon.tsx`)
- [x] "Ticket" converter: a blue From panel (big borderless value input + unit chips) and a red To panel (big result + unit chips + copy), with a round swap button between them that spins
- [x] Nudge buttons for the value: ×10, ÷10, ± sign
- [x] Result pops in when it changes (respecting reduced motion)
- [x] "Put it in perspective": the value compared with everyday things (bananas, buses, pools…), the closest match drawn as a row of emoji; temperature gets a thermometer with landmarks and a mood line instead
- [x] Every-unit list: magnitude bars (log scale) behind each row; click sets the To unit
- [x] README: Unit Converter section + Feature List entry
- [x] Verify: `npm run lint`, `npm run build`, run in the browser

## Result

Done. New files: `Perspective.tsx` (comparisons panel, emoji row, thermometer) and `comparisons.ts` (category icons, everyday sizes, temperature moods; named so it doesn't clash with `Perspective.tsx` on case-insensitive filesystems). New icons in `Icon.tsx`. The From/To panels stack on narrow widths and sit side by side from 660px (container query on `.unit-tool`). Checked with lint, build and Playwright screenshots at 1280px (light) and 390px (dark), no console errors.
