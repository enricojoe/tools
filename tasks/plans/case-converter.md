# Case Converter (frontend)

Branch: `frontend/feature/case-converter`. Frontend only: converting runs in the browser as you type, so the text never leaves the page and needs no API.

## Design

- Tool at `/tools/case-converter` (category Text, new `case` icon). A textarea on one side, every case at once on the other, each with Copy and "Use this" (puts the result back in the textarea, so cases can be chained). After a "Use this", an **Original case** button brings back the text as typed or pasted; typing or Clear drops it.
- Converting lives in `convert.ts` (pure, no React):
  - **Text cases:** UPPER CASE, lower case, Title Case, Sentence case, iNVERSE cASE (swap), aLtErNaTiNg cAsE.
    - Title Case capitalizes every word but keeps small English and Indonesian words ("of", "the", "dan", "di", "yang"…) lowercase unless they start or end a phrase (a line, a sentence or the part after a colon). "don't" → "Don't", "e-mail" → "E-Mail".
    - Sentence case lowercases everything, then capitalizes the first letter of each sentence and the word "I".
  - **Code cases:** camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case, dot.case.
    - Words are split on spaces and punctuation and on case changes, so "XMLHttpRequest", "user_id" and "Hello world" all convert cleanly; digits stay with their word ("HTML5", "v2"). Apostrophes are dropped ("don't" → "dont").
    - Each line is converted on its own, so a list of names converts line by line.
- Draft kept in `localStorage` (try/catch, capped size), like the Word Counter; Clear removes it.
- Results use `useDeferredValue` so typing stays smooth on long text.

## Plan

- [x] `src/tools/case-converter/convert.ts`: the 12 cases and word splitting
- [x] `CaseConverterTool.tsx` + CSS: textarea, case list with Copy / Use this, copy feedback, draft storage
- [x] `case` icon; registry entry
- [x] README: Case Converter section, Progress (Feature List, Suggested Updates)
- [x] Verify: run `convert.ts` against sample texts with Node, `npm run lint`, `npm run build`, the page in the dev server

## Result

Built the Case Converter per the design, frontend only (no API). Also added a `check` icon for the Copied state. Title Case treats each line, sentence and part after a colon as its own phrase ("The Lord of the Rings: The Return of the King").

Verification:

- `convert.ts` run with Node against sample texts: titles with small words and a colon, mixed-case sentences with quotes, "i" and "i'm", identifiers ("XMLHttpRequest", "getHTTPResponseCode", "HTML5Parser", "v2Api", "user_id"), "don't" and "stop-me", multi-line lists with a blank line, accented letters, Indonesian, Chinese with English, empty and whitespace-only text. All twelve cases on 620,000 characters take about 0.4 s.
- `npm run lint` and `npm run build` pass; the dev server serves `/tools/case-converter` and the tool module.
- Not clicked through in a browser.
