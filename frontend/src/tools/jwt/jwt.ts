// JSON Web Tokens (RFC 7519) signed as JWS compact tokens (RFC 7515, algorithms
// from RFC 7518 and RFC 8037). Pure functions on Web Crypto, no React.

export const ALGS = [
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'PS256', 'PS384', 'PS512',
  'ES256', 'ES384', 'ES512',
  'EdDSA', 'none',
] as const

export type Alg = (typeof ALGS)[number]

export type AlgKind = 'hmac' | 'rsa' | 'pss' | 'ec' | 'ed' | 'none'

type Hash = 'SHA-256' | 'SHA-384' | 'SHA-512'

interface AlgInfo {
  kind: AlgKind
  hash?: Hash
  /** Hash size in bytes: the shortest HMAC secret RFC 7518 allows, and the PSS salt length. */
  hashBytes?: number
  curve?: 'P-256' | 'P-384' | 'P-521'
  /** ECDSA signatures are r and s side by side, each this many bytes. */
  sigBytes?: number
}

const INFO: Record<Alg, AlgInfo> = {
  HS256: { kind: 'hmac', hash: 'SHA-256', hashBytes: 32 },
  HS384: { kind: 'hmac', hash: 'SHA-384', hashBytes: 48 },
  HS512: { kind: 'hmac', hash: 'SHA-512', hashBytes: 64 },
  RS256: { kind: 'rsa', hash: 'SHA-256', hashBytes: 32 },
  RS384: { kind: 'rsa', hash: 'SHA-384', hashBytes: 48 },
  RS512: { kind: 'rsa', hash: 'SHA-512', hashBytes: 64 },
  PS256: { kind: 'pss', hash: 'SHA-256', hashBytes: 32 },
  PS384: { kind: 'pss', hash: 'SHA-384', hashBytes: 48 },
  PS512: { kind: 'pss', hash: 'SHA-512', hashBytes: 64 },
  ES256: { kind: 'ec', hash: 'SHA-256', curve: 'P-256', sigBytes: 64 },
  ES384: { kind: 'ec', hash: 'SHA-384', curve: 'P-384', sigBytes: 96 },
  ES512: { kind: 'ec', hash: 'SHA-512', curve: 'P-521', sigBytes: 132 },
  EdDSA: { kind: 'ed', sigBytes: 64 },
  none: { kind: 'none' },
}

export function isAlg(value: unknown): value is Alg {
  return typeof value === 'string' && (ALGS as readonly string[]).includes(value)
}

export function algKind(alg: Alg): AlgKind {
  return INFO[alg].kind
}

/** Shortest secret RFC 7518 allows for an HMAC algorithm, in bytes. */
export function minSecretBytes(alg: Alg): number {
  return INFO[alg].hashBytes ?? 0
}

/** What kind of key an algorithm needs, for messages ("an RSA key", "a P-256 EC key"). */
export function keyDescription(alg: Alg): string {
  const info = INFO[alg]
  if (info.kind === 'rsa' || info.kind === 'pss') return 'an RSA key'
  if (info.kind === 'ec') return `a ${info.curve} EC key`
  if (info.kind === 'ed') return 'an Ed25519 key'
  return 'a secret'
}

export const ALG_NOTES: Record<AlgKind, string> = {
  hmac: 'HMAC with a shared secret: the same secret signs and verifies.',
  rsa: 'RSA (PKCS#1 v1.5): sign with the private key, verify with the public key.',
  pss: 'RSA-PSS: like RS, with randomized padding, so each token is different.',
  ec: 'ECDSA: short keys and signatures; each token is different.',
  ed: 'Ed25519: small, fast and deterministic.',
  none: 'No signature at all: anyone can change the token. Only for testing.',
}

// ---------- Base64URL and text ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(bytes: Uint8Array, url = false): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    const left = bytes.length - i
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += left > 1 ? B64[(n >> 6) & 63] : url ? '' : '='
    out += left > 2 ? B64[n & 63] : url ? '' : '='
  }
  return url ? out.replace(/\+/g, '-').replace(/\//g, '_') : out
}

/** Decodes standard or URL-safe Base64, padded or not. Returns null if it isn't Base64. */
export function base64ToBytes(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/g, '').replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let bits = 0
  let value = 0
  let j = 0
  for (const ch of clean) {
    value = (value << 6) | B64.indexOf(ch)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[j++] = (value >> bits) & 255
    }
  }
  return out
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

export function base64UrlJson(value: unknown): string {
  return bytesToBase64(utf8(JSON.stringify(value)), true)
}

// ---------- Parsing ----------

export type PartName = 'header' | 'payload' | 'signature'

export interface ParsedToken {
  kind: 'jws'
  /** The token as it was used: prefix, quotes and whitespace removed. */
  token: string
  segments: [string, string, string]
  header: Record<string, unknown>
  headerJson: string
  /** The payload as JSON when it is JSON, otherwise null (see payloadText). */
  payload: unknown
  payloadText: string
  signature: Uint8Array
}

export interface ParsedJwe {
  kind: 'jwe'
  token: string
  segments: string[]
  header: Record<string, unknown>
  headerJson: string
}

export type ParseResult =
  | { ok: true; value: ParsedToken | ParsedJwe }
  | { ok: false; error: string; part?: PartName }

/** Removes what usually comes along with a copied token: `Bearer `, quotes, line breaks. */
export function cleanToken(input: string): string {
  return input
    .trim()
    .replace(/^(authorization:\s*)?bearer\s+/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, '')
}

function decodePart(segment: string, part: PartName): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  const bad = segment.search(/[^A-Za-z0-9_-]/)
  if (bad !== -1) {
    const ch = segment[bad]
    const hint = ch === '=' || ch === '+' || ch === '/' ? ' JWTs use URL-safe Base64 (- and _) without = padding.' : ''
    return { ok: false, error: `The ${part} has “${ch}” at character ${bad + 1}, which isn't Base64URL.${hint}` }
  }
  const bytes = base64ToBytes(segment)
  if (!bytes) return { ok: false, error: `The ${part} has a length that can't be Base64URL.` }
  return { ok: true, bytes }
}

function decodeJsonObject(
  segment: string,
  part: PartName,
): { ok: true; value: Record<string, unknown>; json: string } | { ok: false; error: string } {
  const decoded = decodePart(segment, part)
  if (!decoded.ok) return decoded
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(decoded.bytes)
  } catch {
    return { ok: false, error: `The ${part} isn't UTF-8 text.` }
  }
  try {
    const value: unknown = JSON.parse(text)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: `The ${part} is JSON, but not an object ({ … }).` }
    }
    return { ok: true, value: value as Record<string, unknown>, json: text }
  } catch {
    return { ok: false, error: `The ${part} decodes to “${text.slice(0, 40)}${text.length > 40 ? '…' : ''}”, which isn't JSON.` }
  }
}

export function parseToken(input: string): ParseResult {
  const token = cleanToken(input)
  const segments = token.split('.')

  if (segments.length === 5) {
    const header = decodeJsonObject(segments[0], 'header')
    if (!header.ok) return { ok: false, error: header.error, part: 'header' }
    return { ok: true, value: { kind: 'jwe', token, segments, header: header.value, headerJson: header.json } }
  }
  if (segments.length !== 3) {
    const dots = segments.length - 1
    return {
      ok: false,
      error: `A JWT is three parts joined by dots (header.payload.signature); this has ${dots} dot${dots === 1 ? '' : 's'}.`,
    }
  }

  const [h, p, s] = segments
  const header = decodeJsonObject(h, 'header')
  if (!header.ok) return { ok: false, error: header.error, part: 'header' }

  const payloadBytes = decodePart(p, 'payload')
  if (!payloadBytes.ok) return { ok: false, error: payloadBytes.error, part: 'payload' }
  const payloadText = new TextDecoder().decode(payloadBytes.bytes)
  let payload: unknown = null
  try {
    payload = JSON.parse(payloadText)
  } catch {
    // A JWS payload may be anything; it's shown as text.
  }

  const signature = decodePart(s, 'signature')
  if (!signature.ok) return { ok: false, error: signature.error, part: 'signature' }

  return {
    ok: true,
    value: {
      kind: 'jws',
      token,
      segments: [h, p, s],
      header: header.value,
      headerJson: header.json,
      payload,
      payloadText,
      signature: signature.bytes,
    },
  }
}

// ---------- Keys ----------

export interface SecretInput {
  text: string
  /** The secret is Base64 (or Base64URL) of the real bytes. */
  base64: boolean
}

export function secretBytes(secret: SecretInput): Uint8Array | null {
  return secret.base64 ? base64ToBytes(secret.text) : utf8(secret.text)
}

type KeyResult = { ok: true; key: CryptoKey } | { ok: false; error: string }

function importParams(alg: Alg): RsaHashedImportParams | EcKeyImportParams | HmacImportParams | Algorithm {
  const info = INFO[alg]
  switch (info.kind) {
    case 'hmac':
      return { name: 'HMAC', hash: info.hash! }
    case 'rsa':
      return { name: 'RSASSA-PKCS1-v1_5', hash: info.hash! }
    case 'pss':
      return { name: 'RSA-PSS', hash: info.hash! }
    case 'ec':
      return { name: 'ECDSA', namedCurve: info.curve! }
    default:
      return { name: 'Ed25519' }
  }
}

function signParams(alg: Alg): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
  const info = INFO[alg]
  if (info.kind === 'pss') return { name: 'RSA-PSS', saltLength: info.hashBytes! }
  if (info.kind === 'ec') return { name: 'ECDSA', hash: info.hash! }
  return importParams(alg).name
}

const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'] as const

function jwkFits(jwk: JsonWebKey, alg: Alg): string | null {
  const info = INFO[alg]
  const want = info.kind === 'rsa' || info.kind === 'pss' ? 'RSA' : info.kind === 'ec' ? 'EC' : 'OKP'
  if (jwk.kty !== want) return `This JWK is a ${jwk.kty ?? 'key of no type'} key; ${alg} needs ${keyDescription(alg)}.`
  if (info.kind === 'ec' && jwk.crv !== info.curve) return `This JWK is a ${jwk.crv} key; ${alg} needs ${keyDescription(alg)}.`
  if (info.kind === 'ed' && jwk.crv !== 'Ed25519') return `This JWK is a ${jwk.crv} key; EdDSA here needs ${keyDescription(alg)}.`
  return null
}

async function importJwk(jwk: JsonWebKey, alg: Alg, use: 'sign' | 'verify'): Promise<KeyResult> {
  const misfit = jwkFits(jwk, alg)
  if (misfit) return { ok: false, error: misfit }
  // Drop members that would make Web Crypto refuse a key meant for a sibling algorithm.
  const material: JsonWebKey = { ...jwk }
  for (const m of ['alg', 'key_ops', 'use', 'ext'] as const) delete material[m]
  if (use === 'sign' && !('d' in material)) return { ok: false, error: 'This is a public key; signing needs the private key.' }
  if (use === 'verify') for (const m of PRIVATE_JWK_MEMBERS) delete material[m]
  try {
    return { ok: true, key: await crypto.subtle.importKey('jwk', material, importParams(alg), false, [use]) }
  } catch (e) {
    return { ok: false, error: `Couldn't use this JWK for ${alg}: ${errorText(e)}` }
  }
}

async function importDer(
  der: Uint8Array,
  format: 'spki' | 'pkcs8',
  alg: Alg,
  use: 'sign' | 'verify',
): Promise<KeyResult> {
  if (format === 'spki' && use === 'sign') return { ok: false, error: 'This is a public key; signing needs the private key.' }
  const misfit = `This key doesn't fit ${alg}, which needs ${keyDescription(alg)}.`
  if (format === 'spki') {
    try {
      return { ok: true, key: await crypto.subtle.importKey('spki', der as BufferSource, importParams(alg), false, ['verify']) }
    } catch {
      return { ok: false, error: misfit }
    }
  }
  try {
    if (use === 'sign') {
      return { ok: true, key: await crypto.subtle.importKey('pkcs8', der as BufferSource, importParams(alg), false, ['sign']) }
    }
    // Verifying with a private key: take its public half.
    const priv = await crypto.subtle.importKey('pkcs8', der as BufferSource, importParams(alg), true, ['sign'])
    return importJwk(await crypto.subtle.exportKey('jwk', priv), alg, 'verify')
  } catch {
    return { ok: false, error: misfit }
  }
}

/** Reads one DER element's header at `at`: where its contents start and end. */
function derElement(der: Uint8Array, at: number): { tag: number; start: number; end: number } {
  const tag = der[at]
  let len = der[at + 1]
  let start = at + 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = (len << 8) | der[start + i]
    start += n
  }
  return { tag, start, end: start + len }
}

/** The SubjectPublicKeyInfo inside an X.509 certificate, as DER. */
export function spkiFromCertificate(der: Uint8Array): Uint8Array | null {
  try {
    const cert = derElement(der, 0)
    const tbs = derElement(der, cert.start)
    let at = tbs.start
    // version [0] is optional; then serial, signature algorithm, issuer, validity, subject.
    if (der[at] === 0xa0) at = derElement(der, at).end
    for (let i = 0; i < 5; i++) at = derElement(der, at).end
    const spki = derElement(der, at)
    if (spki.tag !== 0x30 || spki.end > der.length) return null
    return der.slice(at, spki.end)
  } catch {
    return null
  }
}

const PEM = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/

/**
 * Imports a key for signing or verifying with `alg`: a secret for HS*, or
 * for the others a PEM (public key, PKCS#8 private key or certificate), a
 * bare Base64 DER key, a JWK or a JWKS (picked by `kid`).
 */
export async function importKey(
  alg: Alg,
  use: 'sign' | 'verify',
  input: string | SecretInput,
  kid?: unknown,
): Promise<KeyResult> {
  if (alg === 'none') return { ok: false, error: 'alg “none” has no key.' }

  if (INFO[alg].kind === 'hmac') {
    const secret = typeof input === 'string' ? { text: input, base64: false } : input
    const bytes = secretBytes(secret)
    if (!bytes) return { ok: false, error: "The secret isn't valid Base64. Untick “Base64” to use it as text." }
    if (bytes.length === 0) return { ok: false, error: 'Type a secret.' }
    const key = await crypto.subtle.importKey('raw', bytes as BufferSource, importParams(alg), false, [use])
    return { ok: true, key }
  }

  const text = (typeof input === 'string' ? input : input.text).trim()
  if (text === '') return { ok: false, error: use === 'sign' ? 'Paste a private key, or generate a key pair.' : 'Paste a public key.' }

  if (text.startsWith('{')) {
    let json: { keys?: JsonWebKey[] } & JsonWebKey
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, error: "This starts like a JWK but isn't valid JSON." }
    }
    if (Array.isArray(json.keys)) {
      const keys = json.keys as (JsonWebKey & { kid?: string })[]
      const byKid = kid === undefined ? undefined : keys.find((k) => k.kid === kid)
      const fitting = keys.filter((k) => jwkFits(k, alg) === null)
      const pick = byKid ?? (fitting.length === 1 ? fitting[0] : undefined)
      if (!pick) {
        const kids = keys.map((k) => k.kid).filter(Boolean)
        return {
          ok: false,
          error:
            kid === undefined
              ? `This JWKS has ${keys.length} keys and the token has no “kid” to pick one; paste just one key.`
              : `No key in this JWKS has kid “${String(kid)}”${kids.length ? ` (it has ${kids.join(', ')})` : ''}.`,
        }
      }
      return importJwk(pick, alg, use)
    }
    return importJwk(json, alg, use)
  }

  const pem = PEM.exec(text)
  if (pem) {
    const label = pem[1]
    const der = base64ToBytes(pem[2])
    if (!der) return { ok: false, error: `The ${label} block isn't valid Base64.` }
    if (label === 'PUBLIC KEY') return importDer(der, 'spki', alg, use)
    if (label === 'PRIVATE KEY') return importDer(der, 'pkcs8', alg, use)
    if (label === 'CERTIFICATE') {
      if (use === 'sign') return { ok: false, error: 'A certificate holds only the public key; signing needs the private key.' }
      const spki = spkiFromCertificate(der)
      return spki ? importDer(spki, 'spki', alg, use) : { ok: false, error: "Couldn't find the public key in this certificate." }
    }
    if (label === 'RSA PRIVATE KEY' || label === 'EC PRIVATE KEY' || label === 'RSA PUBLIC KEY') {
      const isPublic = label.endsWith('PUBLIC KEY')
      const cmd = isPublic
        ? 'openssl rsa -RSAPublicKey_in -in key.pem -pubout'
        : 'openssl pkcs8 -topk8 -nocrypt -in key.pem'
      return { ok: false, error: `“${label}” is an older format browsers can't read. Convert it with: ${cmd}` }
    }
    if (label === 'ENCRYPTED PRIVATE KEY') return { ok: false, error: 'This private key is password-protected; export it without a password.' }
    return { ok: false, error: `“${label}” isn't a key this tool can read.` }
  }

  // Bare Base64 DER, as some tools print keys without the BEGIN/END lines.
  const der = /^[A-Za-z0-9+/=\s_-]+$/.test(text) ? base64ToBytes(text) : null
  if (der && der.length > 16) {
    const asPublic = await importDer(der, 'spki', alg, 'verify')
    if (asPublic.ok) return use === 'verify' ? asPublic : { ok: false, error: 'This is a public key; signing needs the private key.' }
    return importDer(der, 'pkcs8', alg, use)
  }
  return {
    ok: false,
    error: `Paste ${keyDescription(alg)} as a PEM (-----BEGIN ${use === 'sign' ? 'PRIVATE' : 'PUBLIC'} KEY-----) or a JWK.`,
  }
}

function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : String(e)
}

// ---------- Sign and verify ----------

export async function sign(
  alg: Alg,
  header: Record<string, unknown>,
  payload: unknown,
  key: CryptoKey | null,
): Promise<string> {
  const input = `${base64UrlJson({ ...header, alg })}.${base64UrlJson(payload)}`
  if (alg === 'none') return `${input}.`
  if (!key) throw new Error('A key is needed to sign.')
  const signature = await crypto.subtle.sign(signParams(alg), key, utf8(input) as BufferSource)
  return `${input}.${bytesToBase64(new Uint8Array(signature), true)}`
}

export type VerifyResult = { ok: true; valid: boolean; note?: string } | { ok: false; error: string }

export async function verify(token: ParsedToken, key: CryptoKey): Promise<VerifyResult> {
  const alg = token.header.alg
  if (!isAlg(alg) || alg === 'none') return { ok: false, error: 'This token has no signature to check.' }
  const expected = INFO[alg].sigBytes
  if (expected && token.signature.length !== expected) {
    const der = INFO[alg].kind === 'ec' && token.signature[0] === 0x30
    return {
      ok: true,
      valid: false,
      note: `${alg} signatures are ${expected} bytes; this one is ${token.signature.length}.${
        der ? ' It looks DER-encoded, but JWTs need r and s side by side.' : ''
      }`,
    }
  }
  try {
    const input = utf8(`${token.segments[0]}.${token.segments[1]}`)
    const valid = await crypto.subtle.verify(signParams(alg), key, token.signature as BufferSource, input as BufferSource)
    return { ok: true, valid }
  } catch (e) {
    return { ok: false, error: `Couldn't check the signature: ${errorText(e)}` }
  }
}

// ---------- Generating keys ----------

function toPem(label: string, der: ArrayBuffer): string {
  const body = bytesToBase64(new Uint8Array(der)).replace(/.{1,64}/g, '$&\n')
  return `-----BEGIN ${label}-----\n${body}-----END ${label}-----`
}

export interface KeyPairPem {
  privateKey: string
  publicKey: string
}

export async function generateKeyPair(alg: Alg): Promise<KeyPairPem> {
  const info = INFO[alg]
  const params =
    info.kind === 'rsa' || info.kind === 'pss'
      ? { ...importParams(alg), modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }
      : importParams(alg)
  const pair = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair
  const [pkcs8, spki] = await Promise.all([
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
    crypto.subtle.exportKey('spki', pair.publicKey),
  ])
  return { privateKey: toPem('PRIVATE KEY', pkcs8), publicKey: toPem('PUBLIC KEY', spki) }
}

/** A random secret as Base64URL text, long enough for the algorithm. */
export function randomSecret(alg: Alg): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(Math.max(32, minSecretBytes(alg)))), true)
}

export function randomId(): string {
  return crypto.randomUUID()
}
