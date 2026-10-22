# Calendar with Indonesian Holidays (frontend)

Branch: `frontend/feature/calendar`. Uses `GET /api/holidays` from `backend/feature/holidays-api` (see tasks/plans/holidays-api.md).

## Design

- Tool at `/tools/calendar` (category Time): a month grid starting on Sunday, with prev/next and Today.
- Tanggal merah: Sundays and public holidays show a red date; public holidays get a red cell, cuti bersama a dashed blue cell; today has a blue dot. Holiday names show in the cells on wide screens and are hidden on phones.
- Clicking a day (or a holiday in the list) selects it; a card shows its full date and holidays. Changing month selects today if it's in that month, else the 1st.
- Below: the month's holidays with type badge and "in N days" / "N days ago", plus the year's totals.
- Years are fetched once and cached for the page. A year without data says which years are available; fetch errors show a retry button.

## Plan

- [x] `src/api/holidays.ts`: typed client with response validation
- [x] `src/tools/calendar/`: `calendarDate.ts` (grid + formatting), `useHolidays.ts` (per-year cache, retry), `CalendarTool.tsx` + CSS
- [x] `calendar`, `chevronLeft`, `chevronRight` icons; registry entry
- [x] README: Calendar section, Progress
- [x] Verify: build, lint, drive the page in headless Chrome against the backend branch

## Result

Built the Calendar tool per the design.

Verification:

- `npm run build` and `npm run lint` pass.
- Headless Chrome against the `backend/feature/holidays-api` server (via a Vite proxy on another port): October 2026 shows "No holidays this month"; March 2026 lists 7 days (Nyepi 18–19, Idulfitri 20–24) with correct types and cell colors; clicking Nyepi fills the day card; January 2028 shows "No holiday data for 2028 yet … 2025–2027"; Today returns to October 2026. No console errors. Checked light and dark themes, and 390 px width with no horizontal scroll.
