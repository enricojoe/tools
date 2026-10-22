# Indonesian Holidays API (backend)

Branch: `backend/feature/holidays-api`

## Contract

`GET /api/holidays?year=2026` -> `200`:

```json
{"year": 2026, "availableYears": [2025, 2026, 2027], "holidays": [{"date": "2026-01-01", "name": "Tahun Baru 2026 Masehi", "type": "national"}]}
```

- `year`: optional, 1–9999; defaults to the current year in the server's timezone. Anything else -> `400 {"error": "year must be a number between 1 and 9999"}`.
- `holidays`: one entry per day, sorted by date. `type` is `national` (hari libur nasional) or `collective_leave` (cuti bersama). Names are the official Indonesian ones.
- A year without data returns `200` with `holidays: []`; `availableYears` lets the client tell that apart from "no holidays".

Data comes from the SKB 3 Menteri for each year (2025 incl. the August 2025 amendment adding 18 Aug, 2026, 2027). The dates follow lunar/religious calendars and government decisions, so they are listed by hand, not computed.

## Plan

- [x] `internal/holiday`: `Holiday` type, `ForYear`, `Years`, hand-written data per year with sources
- [x] `internal/handler`: `Holidays(now)` handler with injectable clock
- [x] Register `GET /api/holidays` in the router
- [x] Tests: data integrity (valid, in-year, ascending, named, typed), `ForYear` copy, handler table tests
- [x] Add the endpoint to the README API table
- [x] Verify: build, vet, test, run server and curl

## Result

Added `GET /api/holidays` per the contract, backed by `internal/holiday` (`data.go` holds 2025–2027 with SKB numbers in a comment; adding a year means appending its entries).

Verification:

- `gofmt -l`, `go build ./... && go vet ./... && go test ./...` all pass (`handler`, `holiday`, `qr` ok).
- Live server: `?year=2027` returned 26 entries starting `2027-01-01 Tahun Baru 2027 Masehi`; `?year=2030` returned `holidays: []`; `?year=x` returned 400; no `year` returned 2026. Per-year counts match the decrees: 2025 17 national + 11 cuti bersama, 2026 17 + 8, 2027 18 + 8.
