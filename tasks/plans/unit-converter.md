# Unit Converter (backend + frontend)

Branch: `project/feature/unit-converter`. Built by two agents in parallel: one on `backend/`, one on `frontend/`, against the contract below.

## Contract

### `GET /api/units`

Lists every category and its units, in display order. `200`:

```json
{
  "categories": [
    {
      "id": "length",
      "name": "Length",
      "units": [{"id": "m", "name": "Meter", "symbol": "m"}, {"id": "ft", "name": "Foot", "symbol": "ft"}]
    }
  ]
}
```

Sends `Cache-Control: public, max-age=86400`.

### `GET /api/units/convert?category=length&from=m&value=1`

Converts `value` from unit `from` to every unit in the category (including `from` itself). `200`:

```json
{
  "category": "length",
  "from": "m",
  "value": 1,
  "results": [{"unit": "km", "value": 0.001}, {"unit": "m", "value": 1}, {"unit": "ft", "value": 3.280839895013123}]
}
```

- `results` follows the unit order of `GET /api/units`; values are full float64 precision (rounding is the frontend's job).
- `value` is a decimal number (Go `strconv.ParseFloat`), must be finite, `|value| <= 1e15`.
- Temperature below absolute zero is rejected (`400`).
- Missing/unknown `category`, unknown `from` for that category, or missing/invalid `value` -> `400 {"error": "..."}`.
- Successful responses send `Cache-Control: public, max-age=86400`.

### Categories and units (ids)

| Category (`id`) | Units (`id`) |
| --- | --- |
| Length (`length`) | `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, `mi`, `nmi` |
| Mass (`mass`) | `mg`, `g`, `kg`, `t`, `oz`, `lb`, `st` |
| Temperature (`temperature`) | `c`, `f`, `k` |
| Volume (`volume`) | `ml`, `l`, `m3`, `tsp`, `tbsp`, `floz`, `cup`, `pt`, `qt`, `gal` (US customary) |
| Area (`area`) | `mm2`, `cm2`, `m2`, `ha`, `km2`, `in2`, `ft2`, `yd2`, `ac`, `mi2` |
| Speed (`speed`) | `mps`, `kmh`, `mph`, `kn`, `fps` |
| Time (`time`) | `ms`, `s`, `min`, `h`, `d`, `wk`, `yr` (365 days) |
| Data (`data`) | `b` (bit), `B`, `kB`, `MB`, `GB`, `TB`, `KiB`, `MiB`, `GiB`, `TiB` |
| Pressure (`pressure`) | `pa`, `kpa`, `bar`, `psi`, `atm`, `mmhg` |
| Energy (`energy`) | `j`, `kj`, `cal`, `kcal`, `wh`, `kwh` |

Linear units are a factor to the category's base unit; temperature converts through kelvin.

## Plan

- [x] Plan, todo entry, README "Working On"
- [x] Backend agent: `internal/units` (unit table, `Convert`), `handler/units.go`, routes, tests; gofmt, vet, `go test -race`, curl
- [x] Frontend agent: `src/api/units.ts`, `src/tools/unit-converter/`, registry entry (+ icon if needed); lint + build
- [x] Integration check: run backend + frontend build, hit both endpoints
- [x] README: Tools entry, API rows, structure, Progress
- [x] Commit and push

## Result

Two agents worked in parallel against the contract above. The backend agent added `internal/units` (unit table, `Convert`, exact factors, temperature through kelvin) plus `handler/units.go`, the routes and tests. The frontend agent added `src/api/units.ts` and `src/tools/unit-converter/` (category tabs, from/to with swap, 250 ms debounced conversion with aborts, all-units list, copy, `localStorage`), plus the `ruler` and `swap` icons and a registry entry in a new `Converters` category. Neither changed the contract.

Verification: `gofmt -l .` is clean, and `go vet ./...` and `go test -race ./...` pass. `npm run lint` and `npm run build` pass. Against a running server with the database, curl returned 200 with the cache header for `/api/units` and for `/api/units/convert` (1 mi = 1609.344 m, 100 °C = 212 °F = 373.15 K, 1 GiB = 1073741824 B), and 400 for -1 K. The page itself wasn't clicked through in a browser.
