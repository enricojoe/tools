# Stopwatch Session API (backend)

Branch: `backend/feature/stopwatch-api`

## Contract

`POST /api/stopwatch/sessions` with JSON `{"label"?: string, "elapsedMs": 1–86400000, "laps"?: [int], "completedAt"?: RFC3339}` -> `201`:

```json
{"id": "9f2c…", "label": "Morning run", "elapsedMs": 5000, "laps": [2000, 3000], "completedAt": "2026-03-11T03:00:00+07:00"}
```

- `label` is trimmed and may be up to 100 characters; `laps` are lap durations in ms (each >= 1, at most 1000, sum <= `elapsedMs`) and are always returned as an array; `completedAt` defaults to now and is returned in the server's timezone.
- `400 {"error": "..."}` for out-of-range `elapsedMs`, label too long, a bad lap, too many laps, laps adding up to more than `elapsedMs`, unparseable `completedAt`, `completedAt` more than 1 minute in the future, or a malformed body.

`GET /api/stopwatch/sessions?limit=50` -> `200 {"sessions": [...]}`, newest `completedAt` first; `limit` is 1–200 (default 50), invalid -> `400`; `Cache-Control: no-store`.

`DELETE /api/stopwatch/sessions/:id` -> `204`, or `404 {"error": "..."}` if the session does not exist.

Sessions live in memory only (lost on restart); the store keeps the newest 1,000.

## Plan

- [x] `internal/stopwatch`: `Session`, random hex IDs, `Repository` interface (`Add`, `List`, `Delete`), thread-safe capped in-memory `Store`
- [x] `internal/handler`: `CreateStopwatchSession`, `ListStopwatchSessions`, `DeleteStopwatchSession` with injectable store and clock
- [x] Register the three routes in the router
- [x] Tests: store (ordering, limit, cap, delete, concurrency), handler table tests (valid create, every 400, laps sum rule, future `completedAt`, limit bounds, ordering, delete/404)
- [x] Add the endpoints to the README API table and Project Structure
- [x] Verify: gofmt, vet, test (with `-race`), and curl each endpoint against a running server

## Result

Added all three endpoints per the contract. The handlers depend on `stopwatch.Repository` (`Add`, `List`, `Delete`), so a database-backed implementation can replace the in-memory `Store` without touching them; `router.New` creates one shared `Store`.

Verification: `gofmt -l .` is clean, and `go vet ./...` and `go test -race ./...` pass. Each endpoint was also called with curl against a server on port 18089 (201, 200 with `no-store`, 400 on `limit=0`, 204, 404).
