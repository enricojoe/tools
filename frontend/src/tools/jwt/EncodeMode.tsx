import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { CLAIMS, formatDate, isTimestamp, looksLikeMilliseconds, relative } from './claims'
import {
  ALG_NOTES,
  algKind,
  generateKeyPair,
  importKey,
  isAlg,
  keyDescription,
  minSecretBytes,
  randomId,
  randomSecret,
  secretBytes,
  sign,
  type Alg,
  type AlgKind,
} from './jwt'
import { CopyButton, Sticker, TokenField } from './parts'
import { looksLikePublicKey } from './warnings'
import { parseObject, pretty, useNowSeconds } from './util'

export interface EncodeState {
  alg: Alg
  header: string
  payload: string
  secret: string
  base64: boolean
  privateKey: string
  /** The public half of a generated pair, kept while `privateKey` is still that pair's. */
  pair: { privateKey: string; publicKey: string } | null
}

interface Props {
  state: EncodeState
  update: (patch: Partial<EncodeState>) => void
  onDecode: (token: string) => void
}

const GROUPS: { kind: AlgKind; label: string; algs: Alg[] }[] = [
  { kind: 'hmac', label: 'HMAC', algs: ['HS256', 'HS384', 'HS512'] },
  { kind: 'rsa', label: 'RSA', algs: ['RS256', 'RS384', 'RS512'] },
  { kind: 'pss', label: 'RSA-PSS', algs: ['PS256', 'PS384', 'PS512'] },
  { kind: 'ec', label: 'ECDSA', algs: ['ES256', 'ES384', 'ES512'] },
  { kind: 'ed', label: 'EdDSA', algs: ['EdDSA'] },
  { kind: 'none', label: 'Unsigned', algs: ['none'] },
]

const EXPIRY: { label: string; seconds: number }[] = [
  { label: '15 min', seconds: 15 * 60 },
  { label: '1 h', seconds: 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '7 days', seconds: 7 * 86400 },
]

type Output = { ok: true; token: string } | { ok: false; errors: string[] }

export function EncodeMode({ state, update, onDecode }: Props) {
  const ids = useId()
  const now = useNowSeconds()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const kind = algKind(state.alg)
  const deferred = useDeferredValue(state)

  const header = useMemo(() => parseObject(state.header, 'header'), [state.header])
  const payload = useMemo(() => parseObject(state.payload, 'payload'), [state.payload])

  // Signing is async; the output is tagged with the inputs it came from so a
  // slow, older signature never replaces a newer one.
  const outputFor = JSON.stringify([deferred.alg, deferred.header, deferred.payload, deferred.secret, deferred.base64, deferred.privateKey])
  const [output, setOutput] = useState<{ for: string; value: Output } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { alg } = deferred
      const errors: string[] = []
      const h = parseObject(deferred.header, 'header')
      const p = parseObject(deferred.payload, 'payload')
      if (!h.ok) errors.push(h.error)
      if (!p.ok) errors.push(p.error)
      let key: CryptoKey | null = null
      if (alg !== 'none') {
        const input = algKind(alg) === 'hmac' ? { text: deferred.secret, base64: deferred.base64 } : deferred.privateKey
        const imported = await importKey(alg, 'sign', input)
        if (imported.ok) key = imported.key
        else errors.push(imported.error)
      }
      let value: Output
      if (errors.length > 0 || !h.ok || !p.ok) value = { ok: false, errors }
      else {
        try {
          value = { ok: true, token: await sign(alg, h.value, p.value, key) }
        } catch (e) {
          value = { ok: false, errors: [e instanceof Error ? e.message : String(e)] }
        }
      }
      if (!cancelled) setOutput({ for: outputFor, value })
    })()
    return () => {
      cancelled = true
    }
  }, [deferred, outputFor])

  const current = output?.for === outputFor ? output.value : null
  // While a new signature is on its way, keep showing the last token rather than flashing empty.
  const shown = current ?? output?.value ?? null
  const token = shown?.ok ? shown.token : ''

  function chooseAlg(alg: Alg) {
    const patch: Partial<EncodeState> = { alg }
    if (header.ok) patch.header = pretty({ ...header.value, alg })
    update(patch)
  }

  function editHeader(text: string) {
    const patch: Partial<EncodeState> = { header: text }
    const parsed = parseObject(text, 'header')
    if (parsed.ok && isAlg(parsed.value.alg) && parsed.value.alg !== state.alg) patch.alg = parsed.value.alg
    update(patch)
  }

  function setClaim(key: string, value: unknown) {
    if (!payload.ok) return
    update({ payload: pretty({ ...payload.value, [key]: value }) })
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    try {
      const pair = await generateKeyPair(state.alg)
      update({ privateKey: pair.privateKey, pair })
    } catch (e) {
      setGenError(`This browser couldn't make ${keyDescription(state.alg)}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  function decodeIt() {
    onDecode(token)
  }

  const publicKey = state.pair && state.pair.privateKey === state.privateKey ? state.pair.publicKey : null
  const secretLength = kind === 'hmac' ? secretBytes({ text: state.secret, base64: state.base64 })?.length ?? null : null
  const timeClaims = payload.ok
    ? Object.entries(payload.value).filter(([k, v]) => CLAIMS[k]?.time && isTimestamp(v)) as [string, number][]
    : []

  return (
    <div className="jwt-grid">
      <div className="jwt-col">
        <section className="card jwt-card" aria-labelledby={`${ids}-alg`}>
          <h2 className="jwt-label" id={`${ids}-alg`}>
            Algorithm
          </h2>
          <div className="jwt-algs">
            {GROUPS.map((g) => (
              <div key={g.kind} className="jwt-alg-group" role="group" aria-label={g.label}>
                <span className="jwt-alg-group-name">{g.label}</span>
                <div className="jwt-alg-chips">
                  {g.algs.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="jwt-chip"
                      aria-pressed={state.alg === a}
                      onClick={() => chooseAlg(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="hint">{ALG_NOTES[kind]}</p>
        </section>

        <section className="card jwt-card jwt-part jwt-part-header" aria-labelledby={`${ids}-header`}>
          <div className="jwt-head">
            <label className="jwt-label jwt-label-header" id={`${ids}-header`} htmlFor={`${ids}-header-input`}>
              Header
            </label>
            <span className="hint">
              <code>alg</code> follows the chip above
            </span>
          </div>
          <textarea
            id={`${ids}-header-input`}
            className="jwt-code jwt-editor"
            value={state.header}
            onChange={(e) => editHeader(e.target.value)}
            rows={4}
            spellCheck={false}
            aria-invalid={!header.ok || undefined}
          />
          {!header.ok && <p className="hint hint-error">{header.error}</p>}
        </section>

        <section className="card jwt-card jwt-part jwt-part-payload" aria-labelledby={`${ids}-payload`}>
          <label className="jwt-label jwt-label-payload" id={`${ids}-payload`} htmlFor={`${ids}-payload-input`}>
            Payload
          </label>
          <textarea
            id={`${ids}-payload-input`}
            className="jwt-code jwt-editor"
            value={state.payload}
            onChange={(e) => update({ payload: e.target.value })}
            rows={8}
            spellCheck={false}
            aria-invalid={!payload.ok || undefined}
          />
          {!payload.ok && <p className="hint hint-error">{payload.error}</p>}

          <div className="jwt-claim-bar" role="group" aria-label="Add a claim">
            <span className="jwt-claim-bar-label">Set</span>
            <button type="button" className="jwt-pill" disabled={!payload.ok} onClick={() => setClaim('iat', now)}>
              <code>iat</code> now
            </button>
            <span className="jwt-claim-bar-label">
              <code>exp</code> in
            </span>
            {EXPIRY.map((e) => (
              <button
                key={e.label}
                type="button"
                className="jwt-pill"
                disabled={!payload.ok}
                onClick={() => setClaim('exp', now + e.seconds)}
              >
                {e.label}
              </button>
            ))}
            <button type="button" className="jwt-pill" disabled={!payload.ok} onClick={() => setClaim('nbf', now)}>
              <code>nbf</code> now
            </button>
            <button type="button" className="jwt-pill" disabled={!payload.ok} onClick={() => setClaim('jti', randomId())}>
              <code>jti</code> random
            </button>
          </div>

          {timeClaims.length > 0 && (
            <ul className="jwt-times">
              {timeClaims.map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code>{' '}
                  {looksLikeMilliseconds(v) ? (
                    <span className="jwt-row-warn">looks like milliseconds; JWT times are seconds</span>
                  ) : (
                    <>
                      {formatDate(v)} · <strong>{relative(v, now)}</strong>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="jwt-col">
        <section className="card jwt-card jwt-card-token jwt-card-out" aria-labelledby={`${ids}-out`}>
          <div className="jwt-head">
            <h2 className="jwt-label" id={`${ids}-out`}>
              Your token
            </h2>
            <div className="jwt-actions">
              <button type="button" className="btn btn-secondary" onClick={decodeIt} disabled={token === ''}>
                <Icon name="swap" size={18} />
                Decode it
              </button>
              <CopyButton text={token} primary />
            </div>
          </div>

          {token !== '' ? (
            <TokenField value={token} label="Signed JWT" />
          ) : (
            <div className="jwt-empty">
              <p>{shown === null ? 'Signing…' : 'Fix the note below and the token shows up here.'}</p>
            </div>
          )}

          {current && !current.ok && (
            <ul className="jwt-errors" role="alert">
              {current.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {token !== '' && (
            <div className="jwt-stickers">
              <Sticker tone={state.alg === 'none' ? 'bad' : 'plain'}>{state.alg}</Sticker>
              <Sticker tone="plain">{token.length.toLocaleString()} characters</Sticker>
              {current === null && <Sticker tone="plain">Updating…</Sticker>}
            </div>
          )}
          <p className="hint">Signed in your browser with Web Crypto; the key never leaves this page and isn't saved.</p>
        </section>

        <section className="card jwt-card jwt-card-sig" aria-labelledby={`${ids}-key`}>
          <div className="jwt-head">
            <h2 className="jwt-label jwt-label-signature" id={`${ids}-key`}>
              {kind === 'hmac' ? 'Secret' : kind === 'none' ? 'Signature' : 'Private key'}
            </h2>
            {kind === 'hmac' && (
              <button type="button" className="jwt-pill" onClick={() => update({ secret: randomSecret(state.alg), base64: false })}>
                <Icon name="shuffle" size={15} />
                Random secret
              </button>
            )}
            {kind !== 'hmac' && kind !== 'none' && (
              <button type="button" className="jwt-pill" onClick={generate} disabled={generating}>
                <Icon name="sparkle" size={15} />
                {generating ? 'Generating…' : 'Generate key pair'}
              </button>
            )}
          </div>

          {kind === 'none' && (
            <p className="jwt-warn">
              <strong>No signature.</strong> The token ends with a bare dot, and anyone can change it. Use this only to
              test that a server refuses such tokens.
            </p>
          )}

          {kind === 'hmac' && (
            <>
              <textarea
                className="jwt-input jwt-secret"
                value={state.secret}
                onChange={(e) => update({ secret: e.target.value })}
                aria-labelledby={`${ids}-key`}
                placeholder="A shared secret"
                rows={1}
                spellCheck={false}
                autoComplete="off"
              />
              <label className="jwt-check">
                <input type="checkbox" checked={state.base64} onChange={(e) => update({ base64: e.target.checked })} />
                The secret is Base64 (decode it to bytes first)
              </label>
              {secretLength !== null && secretLength > 0 && secretLength < minSecretBytes(state.alg) && (
                <p className="jwt-warn">
                  {secretLength} bytes is short: RFC 7518 asks for at least {minSecretBytes(state.alg)} for {state.alg}.
                  Try “Random secret”.
                </p>
              )}
              {looksLikePublicKey(state.secret) && (
                <p className="jwt-warn">
                  <strong>This secret is a public key.</strong> That's how algorithm-confusion tokens are made: use it only
                  to test that your server refuses HS* tokens where it expects RSA or EC.
                </p>
              )}
            </>
          )}

          {kind !== 'hmac' && kind !== 'none' && (
            <>
              <textarea
                className="jwt-code jwt-key"
                value={state.privateKey}
                onChange={(e) => update({ privateKey: e.target.value })}
                aria-labelledby={`${ids}-key`}
                placeholder={`-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n\nor a private JWK`}
                spellCheck={false}
                rows={5}
              />
              <p className="hint">
                {state.alg} needs {keyDescription(state.alg)}, as PKCS#8 PEM or a JWK.
              </p>
              {genError && (
                <p className="error" role="alert">
                  {genError}
                </p>
              )}
              {publicKey && (
                <div className="jwt-pubkey">
                  <div className="jwt-head">
                    <span className="jwt-field-label">Public key, for whoever verifies</span>
                    <CopyButton text={publicKey} small />
                  </div>
                  <pre className="jwt-code jwt-raw">{publicKey}</pre>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
