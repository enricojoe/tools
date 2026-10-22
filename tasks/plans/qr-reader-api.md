# QR Reader API (backend)

Branch: `backend/feature/qr-reader-api`

## Contract

`POST /api/qr/decode`, `multipart/form-data`, one file field `image`.

- Accepted formats: PNG, JPEG, GIF (detected from content, not the file name). Max 10 MB.
- `200 {"content": "<decoded text>"}`
- `400 {"error": "image is required"}` / `"image must be at most 10 MB"` / `"unsupported image format (use PNG, JPEG or GIF)"`
- `422 {"error": "no QR code found in image"}`
- `500 {"error": "failed to read QR code"}`

The frontend uses this for both file uploads and camera scanning (it posts throttled JPEG frames).

## Plan

- [x] Add a QR decoding library (e.g. `github.com/makiuchi-d/gozxing`), isolated in `internal/qr`
- [x] `internal/qr`: `Decode(img image.Image) (string, error)` and `ErrNotFound`
- [x] `internal/handler`: `QRDecode` handler (body size limit, format check, error mapping)
- [x] Register `POST /api/qr/decode` in the router
- [x] Unit tests: round-trip with `qr.Generate`, blank image -> `ErrNotFound`
- [x] Table-driven handler tests (200, every 400, 422)
- [x] Verify: build, vet, test, run server and curl

## Result

Built `POST /api/qr/decode` per the contract: multipart field `image`, PNG/JPEG/GIF detected from content, max 10 MB (body capped with `http.MaxBytesReader`). Success returns `200 {"content": ...}`; missing field, non-image and oversized uploads return 400; an image with no readable QR code returns 422; other failures return 500. Decoding uses `github.com/makiuchi-d/gozxing` v0.1.1 (pure Go, TRY_HARDER hint), isolated in `internal/qr` (`Decode`, `ErrNotFound`).

Verification:

- `go mod tidy && go build ./... && go vet ./... && go test ./...` all pass (`backend/internal/handler` and `backend/internal/qr` ok). Tests include a QR pasted onto a larger canvas (qr package) and a JPEG of one (handler).
- Live server: `POST /api/qr` then `curl -F image=@q.png /api/qr/decode` returned `200 {"content":"https://example.com/live"}`; a text file returned `400 {"error":"unsupported image format (use PNG, JPEG or GIF)"}`; no body returned `400 {"error":"image is required"}`; an 11 MB file returned `400 {"error":"image must be at most 10 MB"}`.
