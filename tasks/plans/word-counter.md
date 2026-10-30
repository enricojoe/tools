# Word Counter (frontend)

Branch: `frontend/feature/word-counter`. Frontend only: counting runs in the browser as you type, so the text never leaves the page and needs no API.

## Design

- Tool at `/tools/word-counter` (category Text, new `count` icon). A big textarea with live stats.
- Counting lives in `count.ts` (pure, no React):
  - **Words:** `Intl.Segmenter` word segments that are `isWordLike`, so punctuation is skipped, "don't" and "e-mail" stay one word each, and CJK text counts per word rather than per run.
  - **Characters:** grapheme clusters (an emoji or an accented letter is 1), plus a count without whitespace.
  - **Sentences:** `Intl.Segmenter` sentence segments that contain a letter or digit.
  - **Paragraphs:** blocks separated by blank lines; **lines:** non-empty lines.
  - **Reading time** at 238 words per minute, **speaking time** at 130.
  - **Top words:** the most frequent words (case-insensitive), with an option to skip common English and Indonesian words.
- Limit: an optional goal in words or characters with presets (X post 280 chars, meta description 160 chars, SMS 160 chars) and a custom number; a progress bar turns red when you're over.
- Clear and Copy buttons; the text is kept in `localStorage` as a draft (try/catch, capped size) so a reload doesn't lose it.
- Stats use `useDeferredValue` so typing stays smooth on long text.

## Plan

- [x] `src/tools/word-counter/count.ts`: stats, reading time format, top words
- [x] `WordCounterTool.tsx` + CSS: textarea, stat tiles, limit, top words, copy/clear, draft storage
- [x] `count` icon; registry entry
- [x] README: Word Counter section, Progress (Feature List, Suggested Updates); the structure is unchanged
- [x] Verify: run `count.ts` against sample texts with Node, `npm run lint`, `npm run build`, the page in the dev server

## Result

Built the Word Counter per the design, frontend only (no API).

Verification:

- `count.ts` run with Node against sample texts: empty and whitespace-only text, punctuation and contractions ("don't", "e-mail", "3.5", "—"), emoji and accented letters as one character, Chinese and mixed Japanese/English, blank-line paragraphs, top words with and without common words, duration formatting.
- `npm run lint` and `npm run build` pass; the dev server serves `/tools/word-counter` and the tool module.
- Not clicked through in a browser.
