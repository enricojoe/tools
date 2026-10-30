// Text statistics for the word counter. Pure functions, no React.

export const READING_WPM = 238
export const SPEAKING_WPM = 130

export interface TextStats {
  words: number
  characters: number
  charactersNoSpaces: number
  sentences: number
  paragraphs: number
  lines: number
  /** Reading and speaking time in seconds. */
  readingSeconds: number
  speakingSeconds: number
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const wordSegments = new Intl.Segmenter(undefined, { granularity: 'word' })
const sentenceSegments = new Intl.Segmenter(undefined, { granularity: 'sentence' })

const HAS_LETTER = /[\p{L}\p{N}]/u
// Scripts written without spaces between words: they need the segmenter.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

/**
 * Splits text into words. Spaced text splits on whitespace, so "don't",
 * "e-mail" and "3.5" stay one word and lone punctuation like "—" is skipped;
 * runs in scripts without spaces (Chinese, Japanese, Thai, …) go through
 * `Intl.Segmenter`.
 */
export function words(text: string): string[] {
  const out: string[] = []
  for (const token of text.split(/\s+/)) {
    if (!HAS_LETTER.test(token)) continue
    if (UNSPACED.test(token)) {
      for (const s of wordSegments.segment(token)) if (s.isWordLike) out.push(s.segment)
    } else {
      out.push(token.replace(EDGE_PUNCTUATION, ''))
    }
  }
  return out
}

function countGraphemes(text: string): number {
  let n = 0
  for (const _ of graphemes.segment(text)) n++
  return n
}

export function textStats(text: string): TextStats {
  const wordCount = words(text).length
  let sentences = 0
  for (const s of sentenceSegments.segment(text)) if (HAS_LETTER.test(s.segment)) sentences++
  const characters = countGraphemes(text)
  return {
    words: wordCount,
    characters,
    charactersNoSpaces: countGraphemes(text.replace(/\s+/g, '')),
    sentences,
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim() !== '').length,
    lines: text.split('\n').filter((l) => l.trim() !== '').length,
    readingSeconds: Math.ceil((wordCount / READING_WPM) * 60),
    speakingSeconds: Math.ceil((wordCount / SPEAKING_WPM) * 60),
  }
}

/** "0 sec", "45 sec", "3 min", "1 min 20 sec", "1 hr 5 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return m > 0 ? `${h} hr ${m} min` : `${h} hr`
  return s > 0 ? `${m} min ${s} sec` : `${m} min`
}

// Common English and Indonesian words, skipped from "Top words" on request.
const COMMON = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have he her him his how i if in ' +
    'into is it its just me my no not of on or our she so than that the their them then there these they this ' +
    'to too up us was we were what when which who will with would you your ' +
    'ada adalah agar akan aku anda atau bagi bahwa bisa dalam dan dari dengan di dia ini itu juga ke kami kamu ' +
    'karena kita mereka nya oleh pada para saja saya sebagai sudah tidak untuk yang'
  ).split(' '),
)

export interface WordFrequency {
  word: string
  count: number
}

/** The `limit` most frequent words, case-insensitive; ties keep first-seen order. */
export function topWords(text: string, limit: number, skipCommon: boolean): WordFrequency[] {
  const counts = new Map<string, number>()
  for (const w of words(text)) {
    const word = w.toLocaleLowerCase()
    if (skipCommon && COMMON.has(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
