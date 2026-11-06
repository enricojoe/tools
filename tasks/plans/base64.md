# Base64 Encoder / Decoder (frontend)

Branch: `frontend/feature/base64`. Frontend only: encoding and decoding run in the browser, so the text or file never leaves the page and needs no API.

## Design

- Tool at `/tools/base64` (category Converters, new `binary` icon). Encode / Decode chips at the top, input on one side, result on the other.
- Coding lives in `base64.ts` (pure, no React):
  - **Encode:** text as UTF-8 (so emoji and accents round-trip), or the bytes of a picked / dropped file (up to 5 MB). Options: URL-safe alphabet (`-` `_`), padding `=` on or off, wrap lines at 76 characters (MIME), and for files a `data:<type>;base64,` URL.
  - **Decode:** forgiving input: whitespace and line breaks are ignored, both the standard and URL-safe alphabets are accepted, missing padding is fine, and a `data:…;base64,` prefix is stripped (its type kept). Bad input gets an error that says which character, and where.
  - Decoded bytes that are valid UTF-8 show as text; anything else shows as binary: size, a guessed type (PNG, JPEG, GIF, WebP, PDF, ZIP), an image preview for images, a hex preview of the first bytes and a Download button.
- Result has Copy and **Swap** (puts the result in the input and flips the mode, to check a round trip). Sizes before and after are shown.
- Text draft (with the mode) kept in `localStorage` (try/catch, capped size), like the Case Converter; Clear removes it. `useDeferredValue` keeps typing smooth.

## Plan

- [x] `src/tools/base64/base64.ts`: encode, decode with errors, UTF-8 check, type sniffing
- [x] `Base64Tool.tsx` + CSS: mode chips, options, text / file input, result with Copy / Swap / Download, binary preview, draft storage
- [x] `binary` icon; registry entry
- [x] README: Base64 section, Progress (Feature List, Suggested Updates)
- [x] Verify: run `base64.ts` against samples with Node, `npm run lint`, `npm run build`, the page in the dev server

## Result

Built the Base64 tool per the design, frontend only (no API). The binary preview and Download use a `data:` URL instead of an object URL, so there's nothing to revoke.

Verification:

- `base64.ts` run with Node: round trips for empty, 1–4 byte, ASCII, accented, emoji and multi-line text with every option (output matches Node's `Buffer` Base64); URL-safe and unpadded output; 76-character wrapping; errors for a bad character (with line and column), text after padding, too many `=`, and a length that can't be Base64; a `data:image/png;…` URL decoded and sniffed as PNG; a 3 MB binary round trip in about 0.5 s.
- `npm run lint` and `npm run build` pass; the dev server serves `/tools/base64` and the tool module.
- Not clicked through in a browser.

## Improvements (round 2)

- [x] Wrong-mode nudge: Base64 typed into Encode (`looksLikeBase64`: one Base64 word that decodes to text or a known file type) or words typed into Decode (they fail, or decode to unknown bytes) get a "switch" button
- [x] Paste a file or screenshot into Encode; drop a `.txt` into Decode to decode its contents; File button in both modes
- [x] Thumbnail for picked images; size note with the Base64 overhead (+33%)
- [x] Download for every result (text as `.txt`, files with a guessed extension), via a short-lived object URL
- [x] "Try an example" in the empty result; copy announced through a status line instead of `aria-live` on the whole result
- [x] "How it works" fold-out (`explainGroup`): the first 3 bytes as bits, colored by the 6-bit group they go to, each group's number and letter, fill bits faded and `=` padding marked
- [x] README updated

Verification: `explainGroup` matches the real output for "Man", "Ma", "M", "é" and URL-safe bytes; `looksLikeBase64` is true for plain, unpadded, `data:` and PNG Base64 and false for ordinary words ("password", "HelloWorld", "camelCaseVariable", "12345678", "documentation"…); the example decodes to "Selamat pagi! ☕️". `npm run lint` and `npm run build` pass; the dev server serves the page and module. Not clicked through in a browser.

## Separate inputs per mode (round 3)

- [x] Encode and Decode keep their own input (`texts` per mode, deferred together so a mode switch shows the right result at once); switching modes swaps the textarea
- [x] "Decode it" / "Encode it" fill the other mode's input; the wrong-mode nudge moves the text across; Clear empties only the current mode (the picked file belongs to Encode)
- [x] Draft saves both inputs (`{ mode, encode, decode }`) and still reads the old `{ mode, text }` draft into that mode
- [x] README updated

Verification: `npm run lint` and `npm run build` pass. Not clicked through in a browser.
