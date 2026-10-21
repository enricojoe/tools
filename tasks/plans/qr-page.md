# QR code generator page (frontend)

Branch: `frontend/feature/qr-page`. Built against the `POST /api/qr` contract; the backend lands separately.

## Plan

- [x] Add Vite dev proxy: `/api` -> `http://localhost:8080`
- [x] Typed API client `src/api/qr.ts` (returns `Blob`, throws `Error` with the backend `error` message)
- [x] `QRForm` component: textarea, size and error-correction selects, Generate button, 2048-byte check via `TextEncoder`
- [x] `QRPreview` component: image preview and "Download PNG" (`qrcode.png`)
- [x] `App`: loading and error state, object URL revoked on replace and unmount, in-flight request aborted on resubmit
- [x] Replace starter CSS with plain, responsive, accessible styles (light/dark, focus-visible)
- [x] Remove starter assets (`src/assets/*`, `public/icons.svg`)
- [x] Update README project structure and Vite proxy note
- [x] Verify: lint, build, and proxy against a throwaway mock server

## Result

- `npm run lint` and `npm run build` pass.
- Verified through the Vite dev server proxy with a throwaway mock on :8080 (kept outside the repo): valid request returned `200 image/png`, empty content returned `400 {"error":"content is required"}`. Servers stopped afterwards.
- Not tested against the real backend (not present in this branch).
