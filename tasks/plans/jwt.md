# JWT Decoder / Encoder (frontend)

Branch: `frontend/feature/jwt`. Frontend only: decoding, signing and verifying run in the browser with Web Crypto, so tokens and keys never leave the page and need no API.

## Design

- Tool at `/tools/jwt` (category Converters, new `token` icon). **Decode** / **Encode** chips at the top (remembered).
- The token is the hero: shown in three colors (header, payload, signature) split at the dots, with the matching color on the Header and Payload cards, so you can see which part is which.
- **Decode:**
  - Paste a token; a `Bearer ` prefix, quotes and whitespace are stripped. Errors say which part is broken (not 3 parts, bad Base64URL, not JSON). A 5-part JWE is recognized: only its header can be read.
  - Header and payload as formatted JSON with Copy. Registered claims (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) explained in a list; time claims shown as local dates with "in 2 hours" / "3 days ago".
  - Status stickers: algorithm, expiry (valid / expired / not yet valid, ticking every second), signature (verified / doesn't match / not checked), and a warning for `alg: none`.
  - **Lifetime bar:** from `nbf` or `iat` to `exp`, with a "now" marker.
  - **Verify signature:** HS* with a secret (text or Base64); RS*, PS*, ES*, EdDSA with a public key as PEM (SPKI) or JWK / JWKS (picked by `kid`); a private key works too (its public half is used).
- **Encode:**
  - Algorithm chips: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA (Ed25519), none.
  - Header and payload JSON editors (header `alg` follows the chip). Quick claim buttons: `iat` now, `exp` in 15 min / 1 h / 1 day / 7 days, `nbf` now, `jti` random.
  - Key: HS* secret (text or Base64, "random secret" button, a warning when it's shorter than the hash, as RFC 7518 asks); others take a private key as PEM (PKCS#8) or JWK, with a **Generate key pair** button that also shows the public key to copy.
  - Live token in color, Copy, and **Decode it** (opens Decode with the token and the matching key filled in, so it verifies).
- Nothing is saved except the mode and the algorithm: tokens and keys are secrets.
- Logic in pure modules: `jwt.ts` (Base64URL, parse, sign, verify, key import, key generation) and `claims.ts` (claim descriptions, time status, relative time).

## Plan

- [x] `jwt.ts`: Base64URL, `parseToken`, algorithm table, key import (PEM / JWK / JWKS / private → public), `sign`, `verify`, `generateKeyPair`, `randomSecret`
- [x] `claims.ts`: registered claim info, time status, relative time, lifetime fraction
- [x] `JwtTool.tsx` (shell, modes), `DecodeMode.tsx`, `EncodeMode.tsx`, `parts.tsx` (colored token field, copy button, stickers), `util.ts`, `JwtTool.css`
- [x] `token` icon; registry entry
- [x] README: JWT section, Progress (Feature List, Suggested Updates)
- [x] Verify: `jwt.ts` against Node's `crypto` for every algorithm (both directions), bad input errors; `npm run lint`, `npm run build`; click through in a browser (desktop and phone width, light and dark)

## Result

Built per the design, frontend only. Instead of separate JSON cards, header and payload are explained row by row, with the raw JSON in a fold and a Copy JSON button. Both modes stay mounted (hidden), so switching keeps each mode's input; tokens and keys live only in memory.

Verification:

- `jwt.ts` run with Node against `node:crypto`: every algorithm (HS256/384/512, RS*, PS*, ES256/384/512, EdDSA) signs tokens Node verifies, and verifies Node's tokens with a public PEM, private PEM, JWK (with a mismatched `alg` member), private JWK, JWKS by `kid` and bare Base64 DER; HS output matches Node byte for byte; Base64 secrets; tampered payloads and wrong secrets fail; signing with a public key, a key from another family or curve, and SEC1 `EC PRIVATE KEY` get clear errors; an X.509 certificate verifies; a DER-encoded ECDSA signature is pointed out; parse errors (dot count, `=` padding, non-JSON, non-object, bad length), JWE, non-JSON payload, `alg: none`; the jwt.io sample (with `Bearer `) verifies with its secret.
- `npm run lint` and `npm run build` pass.
- Clicked through in Chromium (Playwright) against the dev server, desktop 1440 px light and phone 390 px dark, no console errors and no horizontal scroll: example → verified with expiry and lifetime; wrong / short secret → mismatch and RFC 7518 note; jwt.io sample; broken token error; Encode HS256 and `exp` in 1 day; ES256 with a generated key pair → Decode it → verified; Edit & re-sign; invalid payload error; `alg: none` → Decode → unsigned warning.

## Improvements (round 2)

- [x] High-contrast (forced colors) mode: hide the colored layer (kept for its height) and show the textarea text in system colors, so the token isn't drawn twice
- [x] Clock leeway (none / 30 s / 1 min / 5 min, remembered): `timeState` gets a `grace` state for tokens past `exp` or before `nbf` but within the leeway, shown as a warn sticker
- [x] `warnings.ts`: a heads-up list under the token for `alg: none`, algorithm confusion (public key as HMAC secret; stronger wording when it verifies), `jku` / `x5u`, odd `kid`, lifetime over 30 days, `iat` in the future, secret-looking payload keys. Replaces the separate `alg: none` note
- [x] Secret fields are textareas, so a pasted PEM keeps its line breaks (an `<input>` strips them, which changes the HMAC key); Encode warns when the secret is a public key
- [x] README updated

Verification: `warnings.ts` and the leeway logic with Node (30 checks: leeway boundaries, public-key detection for PEM / JWK / JWKS vs private keys and plain secrets, an HS256 token signed with an RSA public PEM verifying with that PEM and getting the confusion warning, each warning's trigger and non-trigger cases, an ordinary OpenID payload with no warnings); the round 1 crypto suite still passes. `npm run lint` and `npm run build` pass. In Chromium (Playwright): leeway turns "Expired 20 seconds ago" into "…, within leeway" and survives a reload; a token with `jku`, `../` in `kid`, a 3-month life and a `password` claim shows all four notes; a confusion token pasted with its PEM verifies and shows the warning; Encode warns on a PEM secret; with forced colors emulated the colored layer is hidden, the textarea text is visible and the field keeps its height; round 1 walkthrough still passes, no console errors.
