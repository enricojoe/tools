# Server Time API (backend)

Branch: `backend/feature/server-time-api`

## Contract

`GET /api/time` -> `200`:

```json
{"unixMs": 1767323045123, "iso": "2026-01-02T10:04:05.123456789+07:00", "timezone": "Asia/Jakarta", "utcOffsetSeconds": 25200}
```

- `unixMs`: milliseconds since the Unix epoch.
- `iso`: RFC3339Nano in the server's local zone.
- `timezone`: IANA name if known, otherwise the zone abbreviation (e.g. `WIB`, `UTC`).
- `utcOffsetSeconds`: the server local zone's offset from UTC right now.
- `Cache-Control: no-store`. The clock is read once per request so all fields agree.

The frontend Alarm tool uses this to estimate the server clock offset (round-trip based) and to show times in the server's timezone.

## Plan

- [x] `internal/handler`: `ServerTime(now func() time.Time)` handler with injectable clock
- [x] Timezone name: location name, else `TZ` env var, else zone abbreviation
- [x] Register `GET /api/time` in the router
- [x] Table-driven handler tests (fixed clock in non-UTC zones; all fields and Cache-Control)
- [x] Add the endpoint to the README API table
- [x] Verify: build, vet, test, run server and curl

## Result

Added `GET /api/time` per the contract. `handler.ServerTime(now)` takes the clock as a parameter (the router passes `time.Now`), reads it once, and converts to `time.Local`. The timezone name falls back from the location name to the `TZ` env var to the zone abbreviation, because `time.Local.String()` is `"Local"` when `TZ` is unset.

Verification:

- `go build ./... && go vet ./... && go test ./...` all pass (`backend/internal/handler` ok).
- Live server (`PORT=18081`): `curl -i localhost:18081/api/time` returned `200` with `Cache-Control: no-store` and `{"iso":"2026-10-22T16:55:01.075486+07:00","timezone":"WIB","unixMs":1792662901075,"utcOffsetSeconds":25200}` (TZ unset, so the zone abbreviation fallback applied).
