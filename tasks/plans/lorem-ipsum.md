# Lorem Ipsum Generator (backend + frontend)

Branch: `project/feature/lorem-ipsum`.

## Contract

### `GET /api/lorem?unit=paragraphs&count=3&startWithLorem=true&seed=42`

| Param | Values | Default |
| --- | --- | --- |
| `unit` | `paragraphs` (1–50), `sentences` (1–200), `words` (1–2000) | `paragraphs` |
| `count` | integer in the unit's range | `3` |
| `startWithLorem` | `true` / `false`: open with "Lorem ipsum dolor sit amet, consectetur adipiscing elit." | `true` |
| `seed` | 0–4294967295; the same seed and options give the same text | random |

`200`:

```json
{"unit": "paragraphs", "count": 3, "seed": 42, "paragraphs": ["Lorem ipsum dolor sit amet, ...", "..."], "words": 187}
```

- `sentences` and `words` return a single paragraph.
- With a `seed` the response sends `Cache-Control: public, max-age=86400`; without one, `no-store`.
- Invalid unit, count, flag or seed -> `400 {"error": "..."}`.

## Plan

- [x] Plan, todo entry, README "Working On"
- [x] Backend: `internal/lorem` (word list, seeded generator), `handler/lorem.go`, route, tests; gofmt, vet, `go test -race`, curl
- [x] Frontend: `src/api/lorem.ts`, `src/tools/lorem-ipsum/` (unit + count + options, plain/HTML output, copy, regenerate), icon, registry entry; lint + build
- [x] README: Tools entry, API row, structure, Progress

## Result

Backend: `internal/lorem` builds text from a seeded PCG generator over a Latin word list (sentences of 6–16 words with an occasional comma, paragraphs of 4–8 sentences); `handler/lorem.go` parses and validates the query and picks a random seed when none is given. Frontend: `src/api/lorem.ts` and `src/tools/lorem-ipsum/` (unit chips, count field + slider, opening toggle, plain/HTML format, 250 ms debounced fetch with aborts, shuffle, copy, counts), a `text` icon and a registry entry under Generators.

Verification: `gofmt -l .` is clean, `go vet ./...` and `go test -race` (lorem, handler, router) pass; `npm run lint` and `npm run build` pass. Against a running server, curl returned 200 with the cache header for a seeded request, `no-store` with a random seed for an unseeded one, and 400 for `count=99`. The page itself wasn't clicked through in a browser.
