// Case conversions for the case converter. Pure functions, no React.

export type CaseGroup = 'text' | 'code'

export interface CaseStyle {
  id: string
  label: string
  group: CaseGroup
  convert: (text: string) => string
}

// Small words Title Case keeps lowercase mid-line, in English and Indonesian.
const MINOR = new Set(
  (
    'a an and as at but by for from in into nor of on onto or per the to via vs with ' +
    'atau bagi dalam dan dari dengan di ke oleh pada sebagai tentang untuk yang'
  ).split(' '),
)

const TITLE_WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’]*/gu
const TITLE_PHRASE = /[^\n.!?:…]+[.!?:…]*/gu
// After lowercasing: the first letter of the text, of a line, or after a
// sentence end, skipping opening quotes and brackets.
const SENTENCE_START = /(^|[.!?…]\s+|\n)([\s"'“‘([]*)(\p{L})/gu
const LONE_I = /(?<![\p{L}\p{N}'’])i(?![\p{L}\p{N}])/gu
const APOSTROPHE = /(\p{L})['’](?=\p{L})/gu
// One identifier word: "XML" before "Http", "Http", a caps run with its
// digits ("HTML5"), a lowercase run with its digits ("v2"), or a run in a
// script without case.
const CODE_WORD = /\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?[\p{Ll}\p{N}]+|\p{Lu}+\p{N}*|[\p{L}\p{M}\p{N}]+/gu

function capitalize(word: string): string {
  const [first = '', ...rest] = word
  return first.toUpperCase() + rest.join('').toLowerCase()
}

function hasCase(ch: string): boolean {
  return ch.toLowerCase() !== ch.toUpperCase()
}

/** Capitalizes each word of a phrase except small words that are not first or last. */
function titlePhrase(phrase: string): string {
  const last = (phrase.match(TITLE_WORD) ?? []).length - 1
  let i = 0
  return phrase.replace(TITLE_WORD, (word) => {
    const index = i++
    return index === 0 || index === last || !MINOR.has(word) ? capitalize(word) : word
  })
}

function titleCase(text: string): string {
  // Each line, sentence and part after a colon is its own phrase, so
  // "the end: a story" becomes "The End: A Story".
  return text.toLowerCase().replace(TITLE_PHRASE, titlePhrase)
}

function sentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(SENTENCE_START, (_, before: string, open: string, letter: string) => before + open + letter.toUpperCase())
    .replace(LONE_I, 'I')
}

function inverseCase(text: string): string {
  let out = ''
  for (const ch of text) out += ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
  return out
}

function alternatingCase(text: string): string {
  let out = ''
  let upper = false
  for (const ch of text) {
    if (!hasCase(ch)) {
      out += ch
      continue
    }
    out += upper ? ch.toUpperCase() : ch.toLowerCase()
    upper = !upper
  }
  return out
}

/** Splits one line into identifier words: "XMLHttpRequest" → XML, Http, Request. */
export function codeWords(line: string): string[] {
  return line.normalize('NFC').replace(APOSTROPHE, '$1').match(CODE_WORD) ?? []
}

/** Builds a code case that converts each line of the text on its own. */
function codeCase(join: (words: string[]) => string): (text: string) => string {
  return (text) =>
    text
      .split(/\r?\n/)
      .map((line) => {
        const words = codeWords(line)
        return words.length > 0 ? join(words) : ''
      })
      .join('\n')
}

const lower = (words: string[]) => words.map((w) => w.toLowerCase())

export const CASES: CaseStyle[] = [
  { id: 'upper', label: 'UPPER CASE', group: 'text', convert: (t) => t.toUpperCase() },
  { id: 'lower', label: 'lower case', group: 'text', convert: (t) => t.toLowerCase() },
  { id: 'title', label: 'Title Case', group: 'text', convert: titleCase },
  { id: 'sentence', label: 'Sentence case', group: 'text', convert: sentenceCase },
  { id: 'inverse', label: 'iNVERSE cASE', group: 'text', convert: inverseCase },
  { id: 'alternating', label: 'aLtErNaTiNg cAsE', group: 'text', convert: alternatingCase },
  {
    id: 'camel',
    label: 'camelCase',
    group: 'code',
    convert: codeCase((w) => w[0].toLowerCase() + w.slice(1).map(capitalize).join('')),
  },
  { id: 'pascal', label: 'PascalCase', group: 'code', convert: codeCase((w) => w.map(capitalize).join('')) },
  { id: 'snake', label: 'snake_case', group: 'code', convert: codeCase((w) => lower(w).join('_')) },
  {
    id: 'constant',
    label: 'CONSTANT_CASE',
    group: 'code',
    convert: codeCase((w) => w.map((x) => x.toUpperCase()).join('_')),
  },
  { id: 'kebab', label: 'kebab-case', group: 'code', convert: codeCase((w) => lower(w).join('-')) },
  { id: 'dot', label: 'dot.case', group: 'code', convert: codeCase((w) => lower(w).join('.')) },
]
