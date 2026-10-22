# Alarm & Timer pages (frontend)

Branch: `frontend/feature/alarm-timer`

## Design

Two tools, category `Time`: `alarm` and `timer`, sharing a few helpers in `src/tools/shared/`.

- **Server clock:** `src/api/time.ts` calls `GET /api/time` (see `tasks/plans/server-time-api.md`) and estimates the offset as `serverUnixMs + rtt/2 - Date.now()` at response time. `useServerClock` syncs on mount, every 60 s and when the tab becomes visible, and exposes a per-second `now`, `serverNow()`, timezone, loading and error state. No fallback to browser time: if the first sync fails the alarm page shows the error with a retry and does not ring.
- **Server timezone:** times are shown and alarms interpreted by shifting server ms by `utcOffsetSeconds` and reading UTC fields (a fixed offset, refreshed on every sync).
- **Alarm:** stored in `localStorage` (try/catch, validated on load). Ring detection checks the range (previous check, now] on each tick instead of exact equality, so throttled or sleeping tabs still ring and ranges never overlap (no double ring). Occurrences older than 10 minutes are skipped as stale. One-shot alarms switch off when they fire; snooze stores `snoozeUntil` (server ms).
- **Timer:** state machine idle/running/paused/done, counting down to an `endAt` timestamp (`Date.now()`, so it stays right across sleep). Tab title shows the remaining time while running.
- **Shared:** `alert.ts` (Web Audio double beep, `notify`), `useAlert.ts` (sound and permission hooks), `NotifyPrompt`, `RingDialog` (native `<dialog>`, alert dialog role).
- `ApiError`/`toApiError` moved to `src/api/client.ts`; `qr.ts` re-exports `ApiError` so existing imports keep working.

## Plan

- [x] `src/api/client.ts` (shared error type) and `src/api/time.ts`
- [x] `useServerClock` hook
- [x] Shared beep, notification, ring dialog
- [x] Alarm tool (form, list, ringing, persistence)
- [x] Timer tool (inputs, presets, controls, progress ring, title)
- [x] Registry entries and icons
- [x] README sections and Progress
- [x] Verify: build, lint, dev server against a mock `/api/time`

## Result

Built both tools as designed. `npm run build` and `npm run lint` pass. With a mock `/api/time` on :8080 and Vite on :5199, `/tools/alarm`, `/tools/timer` and the proxied `/api/time` all returned 200 and the mock logged the requests. The pure schedule helpers (`nextOccurrence`, formatting) were checked with a small script. Not yet tested in a real browser: audio, notifications, the dialog and the ring flow need a manual pass once the real backend is running.
