# Pomodoro Session API (backend)

Branch: `backend/feature/pomodoro-api`

## Contract

`POST /api/pomodoro/sessions` with JSON `{"kind": "focus"|"short_break"|"long_break", "durationSeconds": 1–14400, "label"?: string, "completedAt"?: RFC3339}` -> `201`:

```json
{"id": "9f2c…", "kind": "focus", "durationSeconds": 1500, "label": "Write report", "completedAt": "2026-03-11T03:00:00+07:00"}
```

- `label` is trimmed and may be up to 100 characters; `completedAt` defaults to now and is returned in the server's timezone.
- `400 {"error": "..."}` for a bad kind, out-of-range duration, label too long, unparseable `completedAt`, `completedAt` more than 1 minute in the future, or a malformed body.

`GET /api/pomodoro/sessions?date=2026-03-11` -> `200`:

```json
{"date": "2026-03-11", "sessions": [], "focusCount": 0, "focusSeconds": 0}
```

- `date`: optional `YYYY-MM-DD`, defaults to today in the server's timezone; invalid -> `400`.
- `sessions`: those whose `completedAt` falls on that date in the server's timezone, oldest first, `[]` when empty. `focusCount` and `focusSeconds` count `focus` sessions only.
- `Cache-Control: no-store`.

Sessions live in memory only (lost on restart); the store keeps the newest 10,000.

## Plan

- [x] `internal/pomodoro`: `Session`, `Kind` validation, random hex IDs, `Repository` interface, thread-safe capped in-memory `Store`
- [x] `internal/handler`: `CreatePomodoroSession` and `ListPomodoroSessions` with injectable store and clock
- [x] Register both routes in the router
- [x] Tests: store (ordering, range bounds, cap, concurrency), handler table tests (valid create, every 400, timezone date boundaries, default date, empty list is `[]`, focus totals ignore breaks)
- [x] Add the endpoints to the README API table and Project Structure
- [x] Verify: gofmt, vet, test (with `-race`)

## Result

Added both endpoints per the contract. The handlers depend on `pomodoro.Repository` (`Add`, `Between`), so a database-backed implementation can replace the in-memory `Store` without touching them; `router.New` creates one shared `Store`.

Verification: `gofmt -l .` is clean, and `go vet ./...` and `go test -race ./...` pass (`handler`, `holiday`, `pomodoro`, `qr`). Date filtering is tested with Jakarta (UTC+7) sessions on both sides of midnight.
