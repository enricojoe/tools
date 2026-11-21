// Common JWT mistakes, spotted in a decoded token. Pure, no React.

import { duration, isTimestamp, looksLikeMilliseconds } from './claims'

export interface Warning {
  id: string
  /** `bad` is a security hole, `warn` is worth a second look. */
  tone: 'bad' | 'warn'
  title: string
  text: string
}

export interface WarningInput {
  header: Record<string, unknown>
  payload: unknown
  nowSec: number
  leeway: number
  /** What the user typed to verify with, and whether the token is HMAC-signed. */
  hmac: boolean
  keyText: string
  verified: boolean
}

/** Lifetimes longer than this get a note; access tokens usually live minutes to hours. */
export const LONG_LIFETIME_SEC = 30 * 86400

const SENSITIVE_KEY =
  /^(pass|passwd|pwd|pin|cvv|cvc|ssn|nik|npwp|card|cc|card_?number|credit_?card|api_?key|private_?key|client_?secret)$|password|secret/i

/** True when text is a public key (PEM, certificate or public JWK), which should never be an HMAC secret. */
export function looksLikePublicKey(text: string): boolean {
  const t = text.trim()
  if (/-----BEGIN (?:RSA |EC )?PUBLIC KEY-----|-----BEGIN CERTIFICATE-----/.test(t)) return true
  if (t.startsWith('{')) {
    try {
      const jwk = JSON.parse(t) as { kty?: unknown; d?: unknown; keys?: unknown }
      if (Array.isArray(jwk.keys)) return true
      return (jwk.kty === 'RSA' || jwk.kty === 'EC' || jwk.kty === 'OKP') && jwk.d === undefined
    } catch {
      return false
    }
  }
  return false
}

/** Payload keys (two levels deep) whose names suggest a secret, as dotted paths. */
export function sensitiveKeys(payload: unknown): string[] {
  const found: string[] = []
  const walk = (value: unknown, path: string, depth: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 2) return
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k
      if (SENSITIVE_KEY.test(k)) found.push(p)
      else walk(v, p, depth + 1)
    }
  }
  walk(payload, '', 1)
  return found
}

export function tokenWarnings({ header, payload, nowSec, leeway, hmac, keyText, verified }: WarningInput): Warning[] {
  const out: Warning[] = []
  const alg = header.alg

  if (alg === 'none') {
    out.push({
      id: 'none',
      tone: 'bad',
      title: 'Unsigned token',
      text: 'With alg “none” anyone can change this token. A server must never accept one.',
    })
  }

  if (hmac && looksLikePublicKey(keyText)) {
    out.push({
      id: 'confusion',
      tone: 'bad',
      title: verified ? 'Algorithm confusion: it verifies with a public key' : 'A public key as the HMAC secret',
      text: verified
        ? `This ${String(alg)} token checks out with a public key as its secret. Anyone has that key, so anyone can make tokens like this. A server must fix the algorithm for each key and never accept HS* where it expects RSA or EC.`
        : `${String(alg)} uses a shared secret, but this is a public key. If a server verifies HS* tokens with its public key, anyone can forge them. (To reproduce it, the key's bytes must match exactly, including the last line break.)`,
    })
  }

  for (const field of ['jku', 'x5u'] as const) {
    const url = header[field]
    if (typeof url === 'string') {
      out.push({
        id: field,
        tone: 'warn',
        title: `The header points to keys at a URL (${field})`,
        text: `A server must only fetch keys from URLs it already trusts. Otherwise anyone can host a key at ${url} and sign with it.`,
      })
    }
  }

  const kid = header.kid
  if (typeof kid === 'string' && /\.\.|[/\\'";|`$]/.test(kid)) {
    out.push({
      id: 'kid',
      tone: 'warn',
      title: 'Odd characters in the key id (kid)',
      text: `“${kid}” has path or quote characters. If a server uses kid in a file path or a database query, this could pick a key the attacker chose.`,
    })
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const { exp, iat, nbf } = payload as { exp?: unknown; iat?: unknown; nbf?: unknown }
    const real = (v: unknown): v is number => isTimestamp(v) && !looksLikeMilliseconds(v)

    if (real(exp)) {
      const start = real(iat) ? iat : real(nbf) ? nbf : nowSec
      if (exp - start > LONG_LIFETIME_SEC) {
        out.push({
          id: 'long',
          tone: 'warn',
          title: real(iat) || real(nbf) ? `Lives ${duration(exp - start)}` : `Expires ${duration(exp - start)} from now`,
          text: 'A stolen token works until it expires. Access tokens usually live minutes to hours, with a refresh token for longer sessions.',
        })
      }
    }

    if (real(iat) && iat > nowSec + leeway) {
      out.push({
        id: 'future',
        tone: 'warn',
        title: 'Issued in the future',
        text: `iat is ${duration(iat - nowSec)} ahead of this device's clock. The issuer's clock (or this one) may be off.`,
      })
    }

    const secrets = sensitiveKeys(payload)
    if (secrets.length > 0) {
      out.push({
        id: 'sensitive',
        tone: 'bad',
        title: 'Secret-looking data in the payload',
        text: `${secrets.map((s) => `“${s}”`).join(', ')}: the payload is only Base64, not encrypted, so anyone holding the token can read it.`,
      })
    }
  }

  return out
}
