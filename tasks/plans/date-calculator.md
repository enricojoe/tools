# Date Calculator (frontend)

Branch: `frontend/feature/date-calculator`. Frontend only: date math runs in the browser. The only API call is the existing `GET /api/holidays`, used when counting working days.

## Design

- Tool at `/tools/date-calculator` (category Time, new `datecalc` icon). Three sticker tabs, the choice remembered on the device:
  - **Add / subtract:** a start date (Today button), a + / − toggle, and amounts in years, months, weeks and days, with quick chips (+10 days, +5 weeks, +1 month, +100 days…). Or switch to **working days**: N working days that skip Saturdays, Sundays and (optionally) Indonesian public holidays and cuti bersama. The answer is a tear-off calendar sheet: weekday, big day number, month and year, "in 10 days" / "3 weeks ago", plus week number, day of year and quarter, and a holiday name if it lands on one. Month math clamps to the month's end (31 Jan + 1 month = 28/29 Feb) and says so.
  - **Between dates:** from / to (swap, include-the-end-day toggle) → total days as the hero, then weeks + days, years-months-days, months, hours, minutes, and working days (weekends and optional holidays skipped).
  - **Convert:** a value and a unit (seconds, minutes, hours, days, weeks, months, years, decades) → the value in every unit, plus a mixed breakdown (e.g. 1 year = 52 weeks 1 day). Year length: 365 days, 365.2425 (Gregorian average, counts leap years) or 366; a month is a twelfth of a year. Whole days / weeks / months / years get a "Count it from today" button that opens Add / subtract with that amount.
- Date math in `dates.ts` (pure): dates are whole day numbers, so adding is integer math and daylight saving or JS's two-digit-year quirk can't shift a day; `YYYY-MM-DD` at the edges.
- Holidays: `useHolidayDays` loads the needed years through `fetchHolidays`, only those the server has data for; years without data are named in a note ("only weekends skipped there"). Errors show a retry; weekends are still skipped.

## Plan

- [x] `dates.ts`: add / subtract with clamping, working days, difference (y-m-d), date facts, duration conversion and breakdown
- [x] `useHolidayDays.ts`: multi-year holiday lookup with cache
- [x] `DateCalculatorTool.tsx` + CSS: tabs, the three modes, result sheet, copy
- [x] `datecalc` icon; registry entry
- [x] README: tool section, Progress (Feature List, Suggested Updates)
- [x] Verify: `dates.ts` against sample cases with Node, `npm run lint`, `npm run build`, the page in a browser

## Result

Built per the design, frontend only. Changes from the plan: a year's length is chosen as 365 / 365.2425 / 366 under "Days in a year"; the Add / subtract form state lives in `state.ts` and the holiday label helper in `useHolidayDays.ts` (fast-refresh lint rule); the holiday note names the years with data ("known for 2025–2027") instead of listing missing years.

Verification:

- `dates.ts` run with Node: +10 days / +5 weeks from 16 Nov 2026, 31 Jan 2028 + 1 month → 29 Feb (clamped), 29 Feb 2028 + 1 year → 28 Feb 2029, year 50 dates, overflow past 9999 → null, ISO weeks around New Year (1 Jan 2027 = week 53 of 2026), y-m-d differences both directions, weekday counts, breakdowns (1 year → 52 weeks and 1 day; 365.2425 → … 5 h 49 min 12 s; 0.1 + 0.2 hours → 18 min).
- `npm run lint` (clean) and `npm run build` pass.
- Clicked through in Chrome (Playwright) against the dev server and running backend: +5 weeks → Mon 21 Dec 2026; 20 Dec 2026 + 5 working days → Tue 29 Dec 2026, skipping 24 and 25 Dec holidays; between 16 Nov 2026 and 1 Jan 2027 → 46 days (32 working, 2 holidays, 12 weekend); Convert → "What date is 1 year from today?" opens Add / subtract with 16 Nov 2027. No console errors; desktop and 390 px phone (dark mode) screenshots checked, no horizontal scroll.
