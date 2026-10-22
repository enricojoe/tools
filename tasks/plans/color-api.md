# Color Info API (backend)

Branch: `backend/feature/color-api`

## Contract

`GET /api/colors?hex=3B82F6` (3 or 6 hex digits, optional `#` sent as `%23`, case-insensitive) -> `200`:

```json
{
  "hex": "#3B82F6",
  "rgb": {"r": 59, "g": 130, "b": 246},
  "hsl": {"h": 217, "s": 91, "l": 60},
  "hsv": {"h": 217, "s": 76, "v": 96},
  "cmyk": {"c": 76, "m": 47, "y": 0, "k": 4},
  "name": "Dodger Blue",
  "exactName": false,
  "contrast": {"white": 3.68, "black": 5.71, "bestText": "#000000"},
  "harmonies": {"complementary": ["#F6AF3B"], "analogous": ["#3BDFF6", "#523BF6"], "triadic": ["#F63B82", "#82F63B"], "splitComplementary": ["#F6523B", "#DFF63B"], "tetradic": ["#F63BDF", "#F6AF3B", "#3BF652"]},
  "shades": ["#CEE0FD", "...", "#021431"]
}
```

- All values are integers except the contrast ratios (2 decimals); hex strings are uppercase `#RRGGBB`.
- `name` is the nearest of the 148 CSS named colors by CIE76 distance in Lab; `exactName` is true when the hex equals it.
- Harmonies rotate the hue in HSL keeping saturation and lightness; `shades` has 9 colors at lightness 90 to 10 (light to dark).
- Missing or invalid `hex` -> `400 {"error": "..."}`. Successful responses send `Cache-Control: public, max-age=86400` (pure function of the input).

## Plan

- [x] `internal/color`: `Parse`, RGB/HSL/HSV/CMYK conversions, nearest CSS name (Lab), WCAG contrast, harmonies, shades, `Describe`
- [x] `internal/handler`: thin `Colors` handler
- [x] Register `GET /api/colors` in the router
- [x] Tests: parsing, conversions, hue wrap, name table (148), contrast, harmonies, shades, handler (valid, `%23`, 3-digit, exact name, invalid inputs)
- [x] Add the endpoint to the README API table and Project Structure
- [x] Verify: gofmt, vet, `go test -race`, curl against a running server

## Result

Added the endpoint per the contract. Color math lives in `internal/color` with no new dependencies; the handler only parses the query and returns `color.Describe`. Internal HSL stays unrounded so harmonies and shades do not accumulate rounding error. The nearest-name search uses Lab, so `#3B82F6` is named "Dodger Blue" (the contract's "Royal Blue" was only an example).

Verification: `gofmt -l .` is clean, `go vet ./...` and `go test -race ./...` pass, and curl against a running server returned 200 for `%233B82F6` and `fa0`, and 400 for `zz`.
