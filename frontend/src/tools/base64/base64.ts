// Base64 encoding and decoding for the Base64 tool. Pure functions, no React.

export interface EncodeOptions {
  /** Use `-` and `_` instead of `+` and `/`, safe in URLs and file names. */
  urlSafe: boolean
  /** End with `=` so the length is a multiple of 4. */
  padding: boolean
  /** Break lines every 76 characters, as MIME (email) does. */
  wrap: boolean
}

export type DecodeResult =
  | { ok: true; bytes: Uint8Array; mime: string | null }
  | { ok: false; error: string }

const WRAP_AT = 76
// btoa takes a "binary string"; building it in chunks keeps
// String.fromCharCode under the engine's argument limit.
const CHUNK = 0x8000
const DATA_URL = /^data:([^;,]*)(?:;[^,]*)?;base64,/i
const VALID = /[A-Za-z0-9+/\-_]/

export function encodeBytes(bytes: Uint8Array, opts: EncodeOptions): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  let out = btoa(binary)
  if (opts.urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_')
  if (!opts.padding) out = out.replace(/=+$/, '')
  if (opts.wrap) out = out.replace(new RegExp(`.{${WRAP_AT}}(?=.)`, 'g'), '$&\n')
  return out
}

export function encodeText(text: string, opts: EncodeOptions): string {
  return encodeBytes(new TextEncoder().encode(text), opts)
}

/** A `data:` URL for the bytes; always the standard alphabet with padding, as browsers expect. */
export function toDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime || 'application/octet-stream'};base64,${encodeBytes(bytes, { urlSafe: false, padding: true, wrap: false })}`
}

/**
 * Decodes Base64 leniently: whitespace is ignored, the standard and URL-safe
 * alphabets are both accepted, padding is optional and a `data:` URL prefix
 * is stripped (its type is returned as `mime`).
 */
export function decode(input: string): DecodeResult {
  let text = input.trim()
  let mime: string | null = null
  let offset = input.length - input.trimStart().length
  const prefix = DATA_URL.exec(text)
  if (prefix) {
    mime = prefix[1] || null
    text = text.slice(prefix[0].length)
    offset += prefix[0].length
  }

  // Find the first character that can't be Base64, so the error can point at it.
  let body = ''
  let padStart = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) continue
    if (ch === '=') {
      if (padStart < 0) padStart = body.length
      body += ch
      continue
    }
    if (!VALID.test(ch) || padStart >= 0) {
      const where = describePosition(input, offset + i)
      return {
        ok: false,
        error: padStart >= 0 && VALID.test(ch)
          ? `Found “${ch}” after the “=” padding (${where}). Padding can only come at the end.`
          : `“${ch}” isn't a Base64 character (${where}).`,
      }
    }
    body += ch
  }

  const data = padStart >= 0 ? body.slice(0, padStart) : body
  const pad = body.length - data.length
  if (pad > 2) return { ok: false, error: `There are ${pad} “=” at the end; Base64 has at most 2.` }
  if (data.length % 4 === 1) {
    return { ok: false, error: 'The text is one character too long or short to be Base64. Is part of it missing?' }
  }

  const standard = data.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { ok: true, bytes, mime }
}

function describePosition(text: string, index: number): string {
  const before = text.slice(0, index)
  const line = before.split('\n').length
  const column = index - before.lastIndexOf('\n')
  return line > 1 ? `line ${line}, column ${column}` : `position ${column}`
}

/** The bytes as text if they are valid UTF-8 without control characters, else null. */
export function bytesToText(bytes: Uint8Array): string | null {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  // Tabs and line breaks are fine; other control characters mean binary.
  // oxlint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000E-\u001F\u007F]/.test(text) ? null : text
}

const SIGNATURES: { mime: string; label: string; bytes: number[]; at?: number }[] = [
  { mime: 'image/png', label: 'PNG image', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', label: 'JPEG image', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', label: 'GIF image', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', label: 'WebP image', bytes: [0x57, 0x45, 0x42, 0x50], at: 8 },
  { mime: 'application/pdf', label: 'PDF document', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/zip', label: 'ZIP archive', bytes: [0x50, 0x4b, 0x03, 0x04] },
]

/** Guesses a file type from its first bytes. */
export function sniffType(bytes: Uint8Array): { mime: string; label: string } | null {
  const match = SIGNATURES.find((s) => s.bytes.every((b, i) => bytes[(s.at ?? 0) + i] === b))
  return match ? { mime: match.mime, label: match.label } : null
}

export const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'text/plain': 'txt',
}

/** The first bytes as hex pairs, 16 per line. */
export function hexPreview(bytes: Uint8Array, limit = 64): string {
  const lines: string[] = []
  for (let i = 0; i < Math.min(bytes.length, limit); i += 16) {
    lines.push(
      [...bytes.subarray(i, Math.min(i + 16, limit))].map((b) => b.toString(16).padStart(2, '0')).join(' '),
    )
  }
  return lines.join('\n') + (bytes.length > limit ? '\n…' : '')
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const LOOKS_B64 = /^[A-Za-z0-9+/_-]+={0,2}$/

/**
 * True when text typed to be encoded is probably Base64 already: one word
 * of Base64 characters (line breaks allowed) that decodes to text or a known
 * file type. Plain words rarely decode to valid UTF-8, so this seldom misfires.
 */
export function looksLikeBase64(text: string): boolean {
  const compact = text.trim().replace(DATA_URL, '').replace(/[\r\n]+/g, '')
  if (compact.length < 8 || !LOOKS_B64.test(compact)) return false
  const decoded = decode(compact)
  return decoded.ok && (bytesToText(decoded.bytes) !== null || sniffType(decoded.bytes) !== null)
}

const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export interface ExplainedByte {
  /** The byte as a printable character, or its hex value. */
  label: string
  bits: string
}

export interface ExplainedSextet {
  bits: string
  index: number
  char: string
}

/** How the first (up to) three bytes become four Base64 characters. */
export function explainGroup(bytes: Uint8Array, urlSafe: boolean): {
  bytes: ExplainedByte[]
  sextets: ExplainedSextet[]
  padding: number
} {
  const group = [...bytes.subarray(0, 3)]
  const explained = group.map((b) => ({
    label: b >= 0x20 && b < 0x7f ? (b === 0x20 ? '␣' : String.fromCharCode(b)) : `0x${b.toString(16).padStart(2, '0')}`,
    bits: b.toString(2).padStart(8, '0'),
  }))
  // The last sextet is filled up with zero bits when the group is short.
  const allBits = explained.map((b) => b.bits).join('')
  const count = Math.ceil(allBits.length / 6)
  const sextets = Array.from({ length: count }, (_, i) => {
    const bits = allBits.slice(i * 6, i * 6 + 6).padEnd(6, '0')
    const index = parseInt(bits, 2)
    let char = STANDARD_ALPHABET[index]
    if (urlSafe) char = char === '+' ? '-' : char === '/' ? '_' : char
    return { bits, index, char }
  })
  return { bytes: explained, sextets, padding: group.length === 0 ? 0 : 4 - count }
}
