# QR Reader page (frontend)

Branch: `frontend/feature/qr-reader-page`

## Design

New tool `qr-reader` in `src/tools/registry.ts`, page under `src/tools/qr-reader/`. Two modes:

- **Upload:** pick or drop an image file, send it to `POST /api/qr/decode` (see `tasks/plans/qr-reader-api.md` for the contract), show the decoded text.
- **Camera:** `getUserMedia` (rear camera preferred), grab a frame every ~500 ms onto a canvas, send it as JPEG to the same endpoint; stop on the first hit. One request in flight at a time; stop the stream on unmount/mode switch.

Result card: decoded text, copy button, "Open link" when it is an http(s) URL, scan again.

## Plan

- [x] `src/api/qr.ts`: `decodeQR(image: Blob, signal?)`
- [x] Register the tool (name, description, icon, keywords)
- [x] Upload mode (file input + drag and drop, preview, errors)
- [x] Camera mode (permission/unsupported errors, cleanup)
- [x] Result card (copy, open link)
- [x] Styles that match the sticker theme in light and dark
- [x] Verify: build, lint, run against the backend

## Result

Built the `qr-reader` tool (registry entry, `src/tools/qr-reader/`): `QRReaderTool` (tabs: Upload / Camera), `UploadReader` (file input + drag and drop, type/10 MB checks, preview), `CameraReader` (getUserMedia, 500 ms frame loop, one request in flight, 422 = keep scanning, full cleanup), `ReaderResult` (copy, http(s)-only Open link, Scan another). `src/api/qr.ts` gained `decodeQR` and a shared `ApiError`/`toApiError`; `Icon` gained scan, camera, upload, copy, external.

Verified: `npm run build` and `npm run lint` pass; dev server serves `/tools/qr-reader`. End-to-end flow verified below; real camera scanning still needs a browser test.

End-to-end check (main thread): backend from `backend/feature/qr-reader-api` on :8080 with Vite on :5180. Through the `/api` proxy, a QR made by `POST /api/qr` decoded to its original text as PNG, as a 1024px JPEG, and as a JPEG padded onto a 1200x900 white canvas; a non-image returned 400. `/tools/qr-reader` served 200. Real camera scanning is still untested in a browser.
