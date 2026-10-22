# Pomodoro (frontend)

Branch: `frontend/feature/pomodoro`. Uses `POST/GET /api/pomodoro/sessions` from `backend/feature/pomodoro-api` (see tasks/plans/pomodoro-api.md).

## Design

- Tool at `/tools/pomodoro` (category Time): focus, then a short break, with a long break after every N focus sessions (defaults 25/5/15 min, N = 4). Shows the phase, a progress ring, dots for the cycle ("Round 2 of 4") and Start / Pause / Resume / Reset / Skip.
- When a phase ends it advances to the next one by itself (idle, or running if "start the next phase automatically" is on). Skip and Reset never log; skipping a focus session doesn't count toward the long break.
- Counts down to an end timestamp (no drift in background tabs); the tab title shows the remaining time and phase; a short beep and a browser notification mark the end of a phase (shared `alert.ts` code).
- Settings (durations, interval, auto-start) are saved in `localStorage` (guarded with try/catch, validated on load). Optional label for the focus session.
- A finished phase is POSTed with its real end time. The "Today" panel (focus count, time focused, session list) comes from GET. If the API fails the timer keeps going; the panel shows a friendly note with "Try again", and sessions that failed to save are kept in memory and re-sent on retry.
- Accessibility: labelled fields, a visually hidden `role="status"` line announces phase and state, the dots are decorative.

## Plan

- [x] `src/api/pomodoro.ts`: typed client with response validation
- [x] Move `formatRemaining` and `useDocumentTitle` from the timer into `tools/shared/` and reuse them
- [x] `src/tools/pomodoro/`: `phases.ts` (settings, storage, cycle logic), `usePomodoroToday.ts`, `PomodoroTool.tsx`, `PomodoroSettings.tsx`, `TodayPanel.tsx` + CSS
- [x] `skip`, `tomato` icons; registry entry
- [x] README: Pomodoro section, Progress
- [x] Verify: build, lint

## Result

Built the Pomodoro tool per the design.

Verification:

- `npm run build` and `npm run lint` pass.
- Not driven against a running backend (it is built in parallel on its own branch); the client codes to the agreed API contract.
