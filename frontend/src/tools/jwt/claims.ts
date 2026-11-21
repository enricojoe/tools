// What a token's claims mean, and where "now" sits in its lifetime. Pure, no React.

export interface ClaimInfo {
  name: string
  about: string
  /** Registered in RFC 7519 (the others are common OpenID Connect claims). */
  registered?: boolean
  time?: boolean
}

export const CLAIMS: Record<string, ClaimInfo> = {
  iss: { name: 'Issuer', about: 'Who made and signed the token.', registered: true },
  sub: { name: 'Subject', about: 'Who the token is about, usually a user id.', registered: true },
  aud: { name: 'Audience', about: 'Who the token is meant for; others should refuse it.', registered: true },
  exp: { name: 'Expires', about: 'After this, the token must be refused.', registered: true, time: true },
  nbf: { name: 'Not before', about: 'Before this, the token must be refused.', registered: true, time: true },
  iat: { name: 'Issued at', about: 'When the token was made.', registered: true, time: true },
  jti: { name: 'Token id', about: 'A unique id, so a used token can be spotted if it comes back.', registered: true },
  auth_time: { name: 'Signed in at', about: 'When the user last signed in.', time: true },
  azp: { name: 'Authorized party', about: 'The app the token was issued to.' },
  nonce: { name: 'Nonce', about: 'Ties the token to one sign-in request.' },
  sid: { name: 'Session id', about: 'The sign-in session this token belongs to.' },
  scope: { name: 'Scope', about: 'What the token allows, as space-separated permissions.' },
  email: { name: 'Email', about: "The user's email address." },
  name: { name: 'Name', about: "The user's full name." },
  roles: { name: 'Roles', about: 'Roles the user has.' },
}

export const HEADER_FIELDS: Record<string, string> = {
  alg: 'Algorithm used to sign the token.',
  typ: 'Type of token, usually “JWT”.',
  kid: 'Key id: which of the issuer’s keys signed it.',
  cty: 'Content type, for a token nested in a token.',
  jku: 'URL of the issuer’s key set.',
  x5c: 'Certificate chain of the signing key.',
  enc: 'Encryption used for the content (JWE).',
}

/** A NumericDate in seconds; values in milliseconds are a common mistake, flagged by the caller. */
export function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** True when a time claim is probably milliseconds (it would be after the year 33658 in seconds). */
export function looksLikeMilliseconds(value: number): boolean {
  return value > 1e12
}

const UNITS: [number, string][] = [
  [365 * 86400, 'year'],
  [30 * 86400, 'month'],
  [7 * 86400, 'week'],
  [86400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
  [1, 'second'],
]

/** "3 hours", "1 day", "45 seconds": the largest whole unit. */
export function duration(seconds: number): string {
  const s = Math.abs(Math.round(seconds))
  for (const [size, unit] of UNITS) {
    if (s >= size) {
      const n = Math.floor(s / size)
      return `${n} ${unit}${n === 1 ? '' : 's'}`
    }
  }
  return '0 seconds'
}

/** "in 2 hours", "3 days ago", "just now". */
export function relative(targetSec: number, nowSec: number): string {
  const diff = targetSec - nowSec
  if (Math.abs(diff) < 1) return 'just now'
  return diff > 0 ? `in ${duration(diff)}` : `${duration(diff)} ago`
}

export function formatDate(sec: number): string {
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return 'not a valid date'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
}

export type TimeState =
  | { state: 'none' }
  | { state: 'expired'; at: number }
  | { state: 'not-yet'; at: number }
  /** Past `exp` or before `nbf`, but within the clock leeway, so a server would still accept it. */
  | { state: 'grace'; at: number; claim: 'exp' | 'nbf' }
  | { state: 'valid'; until?: number }

/** Clock leeway choices in seconds: servers allow a little drift between machines' clocks. */
export const LEEWAYS: { seconds: number; label: string }[] = [
  { seconds: 0, label: 'None' },
  { seconds: 30, label: '30 s' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
]

/** Whether the token is usable right now, by its `exp` and `nbf`, allowing `leeway` seconds of clock drift. */
export function timeState(payload: unknown, nowSec: number, leeway = 0): TimeState {
  if (!payload || typeof payload !== 'object') return { state: 'none' }
  const { exp, nbf } = payload as { exp?: unknown; nbf?: unknown }
  const hasExp = isTimestamp(exp)
  const hasNbf = isTimestamp(nbf)
  if (!hasExp && !hasNbf) return { state: 'none' }
  if (hasExp && nowSec >= exp + leeway) return { state: 'expired', at: exp }
  if (hasNbf && nowSec < nbf - leeway) return { state: 'not-yet', at: nbf }
  if (hasExp && nowSec >= exp) return { state: 'grace', at: exp, claim: 'exp' }
  if (hasNbf && nowSec < nbf) return { state: 'grace', at: nbf, claim: 'nbf' }
  return { state: 'valid', until: hasExp ? exp : undefined }
}

export interface Lifetime {
  start: number
  end: number
  /** Where now is between start (0) and end (1), clamped. */
  fraction: number
  startLabel: 'nbf' | 'iat'
}

/** The span from `nbf` (or `iat`) to `exp`, when the token has both ends. */
export function lifetime(payload: unknown, nowSec: number): Lifetime | null {
  if (!payload || typeof payload !== 'object') return null
  const { exp, nbf, iat } = payload as { exp?: unknown; nbf?: unknown; iat?: unknown }
  if (!isTimestamp(exp)) return null
  const startLabel = isTimestamp(nbf) ? 'nbf' : isTimestamp(iat) ? 'iat' : null
  if (!startLabel) return null
  const start = (startLabel === 'nbf' ? nbf : iat) as number
  if (exp <= start) return null
  const fraction = Math.min(1, Math.max(0, (nowSec - start) / (exp - start)))
  return { start, end: exp, fraction, startLabel }
}
