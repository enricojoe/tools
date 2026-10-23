# Stopwatch (frontend)

Branch: `frontend/feature/stopwatch`. Uses `POST/GET/DELETE /api/stopwatch/sessions` from the backend stopwatch API, built in parallel.

## Design

- Tool at `/tools/stopwatch` (category Time): big `MM:SS.cc` readout (hours appear past 1h), Start / Pause / Resume / Reset / Lap.
- Elapsed time is accumulated time plus `performance.now()` minus the run's start, rendered with `requestAnimationFrame`, so a throttled background tab doesn't drift. It stops at 24 hours; laps cap at 1000.
- Tab title shows the elapsed time while running and is restored afterwards (`useDocumentTitle`).
- Laps table, newest first, with lap time and total; fastest and slowest are highlighted (and tagged in text) once there are 2+ laps with different times.
- Shortcuts: Space start/pause, L lap, R reset; ignored while typing in a field, and Space is left alone on a focused button.
- Optional label. Save is enabled while paused with elapsed > 0 and sends integer ms values. "Saved runs" lists recent runs with delete; if the API fails the stopwatch still works and the list shows an error with Retry.
- Accessibility: the readout is `role="timer"` with `aria-live="off"`; a visually hidden `role="status"` line announces start, pause, lap, reset and save only.

## Plan

- [x] `src/api/stopwatch.ts`: typed client with response validation
- [x] `src/tools/stopwatch/`: `useStopwatch.ts`, `useSavedRuns.ts`, `format.ts`, `SavedRuns.tsx`, `StopwatchTool.tsx` + CSS
- [x] `stopwatch`, `flag` icons; registry entry
- [x] README: Stopwatch section, Feature List
- [x] Verify: build, lint, dev server serves the page

## Result

Built the Stopwatch tool per the design.

Verification:

- `npm run build` and `npm run lint` pass with no warnings.
- The dev server served `/tools/stopwatch` and the component module; no browser was driven and the page was not run against a live backend (it is built in parallel), so the client codes to the agreed API contract.
