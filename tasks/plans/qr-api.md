# QR API (backend)

Branch: `backend/feature/qr-api`

## Plan

- [x] Add `github.com/skip2/go-qrcode` dependency
- [x] `internal/qr`: `Level`, `ParseLevel`, `Generate`, `ErrContentTooLarge` (library isolated here)
- [x] `internal/handler/qr.go`: bind JSON, validate content/size/level, write PNG, map errors to 400/500
- [x] Register `POST /api/qr` in the router
- [x] Unit tests for `qr` package (PNG decodes at requested size, level parsing, too-large content)
- [x] Table-driven handler tests (200 PNG cases, every 400 case)
- [x] Update README "Project Structure"
- [x] Verify: build, vet, test, run server and curl

## Result

Built `POST /api/qr` per the contract: `content` (required, trimmed non-empty, max 2048 bytes), `size` (default 256, 128-1024), `level` (default `M`, one of L/M/Q/H, case-insensitive). Success returns `image/png`; invalid input and content too large to encode return 400 `{"error": ...}`; other failures return 500 `{"error": ...}`.

Verification:

- `go build ./... && go vet ./... && go test ./...` all pass (`backend/internal/handler` and `backend/internal/qr` ok).
- Live server: `POST /api/qr` with size 300, level H returned `200 image/png`, `file` reported `PNG image data, 300 x 300`; size 50 returned `400 {"error":"size must be between 128 and 1024"}`.
