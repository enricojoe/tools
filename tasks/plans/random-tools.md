# Spin Wheel, Dice and Coin Flip (frontend)

Branch: `frontend/feature/random-tools`. Frontend only: every pick happens in the browser, so there's no API.

## Design

- Three tools in a new **Fun** category, each with its own icon: `/tools/spin-wheel`, `/tools/dice`, `/tools/coin-flip`.
- `src/tools/shared/random.ts`: `randomInt(max)` from `crypto.getRandomValues` with rejection sampling (no modulo bias), shared by all three.
- **Spin wheel:** entries one per line (up to 100), an SVG wheel with colored slices, Spin button (or click the wheel / press Space) that turns it 5–8 full turns and eases out on a slice picked up front; the winner pops up with "Remove and spin again"; shuffle, sort, a short history; entries saved in `localStorage`.
- **Dice:** 1–10 dice, die type d4 / d6 / d8 / d10 / d12 / d20 / d100, roll with a tumble animation, d6 drawn with pips, a total plus a modifier, click a die to hold it on re-roll, history of rolls.
- **Coin flip:** 3D flip animation landing on the side picked up front, flip 1 / 10 / 100 at a time, heads vs tails tally with a split bar, longest streak, recent flips as a row of small coins, reset.
- Animations respect `prefers-reduced-motion` (result shows straight away).

## Plan

- [x] `shared/random.ts`
- [x] Spin wheel page + CSS
- [x] Dice page + CSS
- [x] Coin flip page + CSS
- [x] Icons (`wheel`, `dice`, `coin`) and registry entries
- [x] README: tool sections, Progress (Feature List, Suggested Updates)
- [x] Verify: `random.ts` distribution in Node, `npm run lint`, `npm run build`, pages served by the dev server

## Result

Built all three tools per the design, frontend only (no API). Changes from the design: the coin's sides can be renamed (not saved), and a d6 that rolls 1 shows a red pip.

Verification:

- `random.ts` and `wheel.ts` run with Node: `randomInt` over 600k draws for 2, 6, 20 and 100 values gives chi² in the normal range; 100k spins of `planSpin` (2–100 slices) always stop on the chosen slice and turn at least 5 full times; no two neighbouring slices share a color for 2–100 entries.
- `npm run lint` and `npm run build` pass; the dev server serves `/tools/spin-wheel`, `/tools/dice`, `/tools/coin-flip` and their modules.
- Not clicked through in a browser.
