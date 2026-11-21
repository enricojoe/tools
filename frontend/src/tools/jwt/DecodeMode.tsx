import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useStoredState } from '../../layout/useStoredState'
import {
  CLAIMS,
  LEEWAYS,
  HEADER_FIELDS,
  formatDate,
  isTimestamp,
  lifetime,
  looksLikeMilliseconds,
  relative,
  timeState,
  duration,
} from './claims'
import {
  algKind,
  importKey,
  isAlg,
  keyDescription,
  minSecretBytes,
  parseToken,
  secretBytes,
  verify,
  type ParsedToken,
  type VerifyResult,
} from './jwt'
import { CopyButton, Sticker, TokenField } from './parts'
import { pretty, useNowSeconds } from './util'
import { tokenWarnings } from './warnings'

export interface DecodeState {
  token: string
  /** Secret for HS*, public key (PEM / JWK / JWKS) for the others. */
  key: string
  base64: boolean
}

interface Props {
  state: DecodeState
  update: (patch: Partial<DecodeState>) => void
  onExample: () => void
  onEdit: (token: ParsedToken) => void
}

function showValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value.join(', ')
  return JSON.stringify(value)
}

function TimeNote({ value, now }: { value: number; now: number }) {
  if (looksLikeMilliseconds(value)) {
    return (
      <span className="jwt-row-warn">
        Looks like milliseconds; JWT times are seconds. As seconds ÷ 1000: {formatDate(value / 1000)}
      </span>
    )
  }
  return (
    <span className="jwt-row-time">
      {formatDate(value)} · <strong>{relative(value, now)}</strong>
    </span>
  )
}

function FieldRows({ entries, now, kind }: { entries: [string, unknown][]; now: number; kind: 'header' | 'payload' }) {
  return (
    <dl className="jwt-rows">
      {entries.map(([key, value]) => {
        const claim = kind === 'payload' ? CLAIMS[key] : undefined
        const about = kind === 'header' ? HEADER_FIELDS[key] : claim?.about
        return (
          <div key={key} className="jwt-row">
            <dt>
              <code className="jwt-row-key">{key}</code>
              {claim && <span className="jwt-row-name">{claim.name}</span>}
            </dt>
            <dd>
              <span className="jwt-row-value">{showValue(value)}</span>
              {claim?.time && isTimestamp(value) && <TimeNote value={value} now={now} />}
              {about && <span className="jwt-row-about">{about}</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function LifetimeBar({ payload, now }: { payload: unknown; now: number }) {
  const span = lifetime(payload, now)
  if (!span) return null
  const pct = span.fraction * 100
  const over = now >= span.end
  const before = now < span.start
  return (
    <div className="jwt-life">
      <div className="jwt-life-track" aria-hidden="true">
        <div className="jwt-life-fill" style={{ width: `${pct}%` }} data-over={over || undefined} />
        <span className="jwt-life-now" style={{ left: `${pct}%` }}>
          now
        </span>
      </div>
      <div className="jwt-life-ends">
        <span>
          <code>{span.startLabel}</code> {formatDate(span.start)}
        </span>
        <span>
          <code>exp</code> {formatDate(span.end)}
        </span>
      </div>
      <p className="hint">
        Lives {duration(span.end - span.start)} in all.{' '}
        {over
          ? 'Its time is up.'
          : before
            ? `It starts ${relative(span.start, now)}.`
            : `${Math.round(pct)}% used, ${duration(span.end - now)} left.`}
      </p>
    </div>
  )
}

export function DecodeMode({ state, update, onExample, onEdit }: Props) {
  const ids = useId()
  const now = useNowSeconds()
  const [leeway, setLeeway] = useStoredState<number>('jwt:leeway', 0)
  const token = useDeferredValue(state.token)
  const parsed = useMemo(() => (token.trim() === '' ? null : parseToken(token)), [token])
  const jws = parsed?.ok && parsed.value.kind === 'jws' ? parsed.value : null
  const jwe = parsed?.ok && parsed.value.kind === 'jwe' ? parsed.value : null
  const header = parsed?.ok ? parsed.value.header : null

  const rawAlg = header?.alg
  const alg = isAlg(rawAlg) ? rawAlg : null
  const kind = alg ? algKind(alg) : null
  const canVerify = jws !== null && alg !== null && alg !== 'none'
  const keyText = useDeferredValue(state.key)

  // The verdict is tagged with what it was worked out for, so an old answer
  // never shows next to a new token or key.
  const verdictFor = canVerify && keyText.trim() !== '' ? `${jws.token}\n${keyText}\n${state.base64}` : null
  const [verdict, setVerdict] = useState<{ for: string; result: VerifyResult } | null>(null)

  useEffect(() => {
    if (!verdictFor || !jws || !alg) return
    let cancelled = false
    void (async () => {
      const input = kind === 'hmac' ? { text: keyText, base64: state.base64 } : keyText
      const key = await importKey(alg, 'verify', input, jws.header.kid)
      const result: VerifyResult = key.ok ? await verify(jws, key.key) : { ok: false, error: key.error }
      if (!cancelled) setVerdict({ for: verdictFor, result })
    })()
    return () => {
      cancelled = true
    }
  }, [verdictFor, jws, alg, kind, keyText, state.base64])

  const result = verdict && verdict.for === verdictFor ? verdict.result : null
  const time = timeState(jws?.payload, now, leeway)
  const hasTimes = time.state !== 'none'
  const warnings = header
    ? tokenWarnings({
        header,
        payload: jws?.payload,
        nowSec: now,
        leeway,
        hmac: kind === 'hmac',
        keyText,
        verified: result?.ok === true && result.valid,
      })
    : []
  const shortSecret =
    kind === 'hmac' && alg && keyText !== ''
      ? (() => {
          const bytes = secretBytes({ text: keyText, base64: state.base64 })
          return bytes && bytes.length < minSecretBytes(alg) ? bytes.length : null
        })()
      : null

  const payloadEntries =
    jws?.payload && typeof jws.payload === 'object' && !Array.isArray(jws.payload)
      ? Object.entries(jws.payload as Record<string, unknown>)
      : null

  return (
    <div className="jwt-grid">
      <div className="jwt-col">
        <section className="card jwt-card jwt-card-token" aria-labelledby={`${ids}-token`}>
          <div className="jwt-head">
            <h2 className="jwt-label" id={`${ids}-token`}>
              Token
            </h2>
            <div className="jwt-actions">
              {jws && (
                <button type="button" className="btn btn-secondary" onClick={() => onEdit(jws)}>
                  <Icon name="swap" size={18} />
                  Edit &amp; re-sign
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => update({ token: '', key: '' })}
                disabled={state.token === '' && state.key === ''}
              >
                <Icon name="trash" size={18} />
                Clear
              </button>
            </div>
          </div>

          <TokenField
            id={`${ids}-input`}
            value={state.token}
            onChange={(token) => update({ token })}
            label="JWT to decode"
            placeholder="Paste a JWT (eyJhbGciOi…). A “Bearer ” prefix and line breaks are fine."
            invalid={parsed?.ok === false}
          />

          <div className="jwt-legend" aria-hidden="true">
            <span className="jwt-legend-header">header</span>
            <span className="jwt-legend-payload">payload</span>
            <span className="jwt-legend-signature">signature</span>
          </div>

          {parsed === null && (
            <div className="jwt-empty">
              <p>Paste a token above to see what's inside it.</p>
              <button type="button" className="jwt-pill" onClick={onExample}>
                <Icon name="sparkle" size={16} />
                Try an example
              </button>
            </div>
          )}

          {parsed?.ok === false && (
            <p className="error" role="alert">
              {parsed.error}
            </p>
          )}

          {parsed?.ok && (
            <div className="jwt-stickers" aria-live="polite">
              <Sticker tone={rawAlg === 'none' ? 'bad' : alg ? 'plain' : 'warn'}>
                {typeof rawAlg === 'string' ? rawAlg : 'no alg'}
              </Sticker>
              {jwe && <Sticker tone="warn">Encrypted (JWE)</Sticker>}
              {jws && time.state === 'expired' && (
                <Sticker tone="bad" icon={<Icon name="hourglass" size={15} />}>
                  Expired {relative(time.at, now)}
                </Sticker>
              )}
              {jws && time.state === 'not-yet' && (
                <Sticker tone="warn" icon={<Icon name="hourglass" size={15} />}>
                  Not valid yet: starts {relative(time.at, now)}
                </Sticker>
              )}
              {jws && time.state === 'grace' && (
                <Sticker tone="warn" icon={<Icon name="hourglass" size={15} />}>
                  {time.claim === 'exp' ? `Expired ${relative(time.at, now)}` : `Starts ${relative(time.at, now)}`}, within
                  leeway
                </Sticker>
              )}
              {jws && time.state === 'valid' && (
                <Sticker tone="good" icon={<Icon name="hourglass" size={15} />}>
                  {time.until ? `Expires ${relative(time.until, now)}` : 'Valid, never expires'}
                </Sticker>
              )}
              {jws && time.state === 'none' && <Sticker tone="warn">No expiry</Sticker>}
              {canVerify && (
                <Sticker
                  tone={!result ? 'plain' : result.ok && result.valid ? 'good' : 'bad'}
                  icon={<Icon name={result?.ok && result.valid ? 'check' : 'bolt'} size={15} />}
                >
                  {keyText.trim() === ''
                    ? 'Signature not checked'
                    : !result
                      ? 'Checking…'
                      : result.ok
                        ? result.valid
                          ? 'Signature verified'
                          : "Signature doesn't match"
                        : "Signature can't be checked"}
                </Sticker>
              )}
            </div>
          )}

          {jwe && (
            <p className="hint">
              This is an encrypted token (JWE): only its header can be read. The content needs the recipient's key.
            </p>
          )}
          {jws && hasTimes && (
            <div className="jwt-leeway" role="group" aria-label="Clock leeway">
              <span className="jwt-claim-bar-label" title="Servers usually allow a little drift between machines' clocks.">
                Clock leeway
              </span>
              {LEEWAYS.map((l) => (
                <button
                  key={l.seconds}
                  type="button"
                  className="jwt-chip jwt-chip-small"
                  aria-pressed={leeway === l.seconds}
                  onClick={() => setLeeway(l.seconds)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="jwt-heads-up" aria-label="Heads-up">
              {warnings.map((w) => (
                <li key={w.id} className={`jwt-heads-up-item jwt-heads-up-${w.tone}`}>
                  <Icon name={w.tone === 'bad' ? 'bolt' : 'bulb'} size={18} />
                  <span>
                    <strong>{w.title}.</strong> {w.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {header && rawAlg !== undefined && rawAlg !== 'none' && !alg && (
            <p className="jwt-warn">
              “{String(rawAlg)}” isn't an algorithm this tool knows, so the signature can't be checked.
            </p>
          )}

          <p className="hint">Decoded and checked in your browser; tokens and keys are never sent anywhere or saved.</p>
        </section>

        {canVerify && kind && (
          <section className="card jwt-card jwt-card-sig" aria-labelledby={`${ids}-sig`}>
            <div className="jwt-head">
              <h2 className="jwt-label jwt-label-signature" id={`${ids}-sig`}>
                Verify the signature
              </h2>
              <span className="hint">{jws.signature.length}-byte signature</span>
            </div>
            {kind === 'hmac' ? (
              <>
                <label className="jwt-field-label" htmlFor={`${ids}-secret`}>
                  Secret
                </label>
                {/* A textarea, so a pasted multi-line key keeps its exact bytes. */}
                <textarea
                  id={`${ids}-secret`}
                  className="jwt-input jwt-secret"
                  value={state.key}
                  onChange={(e) => update({ key: e.target.value })}
                  placeholder="The shared secret the issuer signs with"
                  rows={1}
                  spellCheck={false}
                  autoComplete="off"
                />
                <label className="jwt-check">
                  <input type="checkbox" checked={state.base64} onChange={(e) => update({ base64: e.target.checked })} />
                  The secret is Base64 (decode it to bytes first)
                </label>
              </>
            ) : (
              <>
                <label className="jwt-field-label" htmlFor={`${ids}-pub`}>
                  Public key
                </label>
                <textarea
                  id={`${ids}-pub`}
                  className="jwt-code jwt-key"
                  value={state.key}
                  onChange={(e) => update({ key: e.target.value })}
                  placeholder={`-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n\nor a JWK / JWKS, or a certificate`}
                  spellCheck={false}
                  rows={5}
                />
                <p className="hint">
                  {alg} needs {keyDescription(alg!)}. A JWKS is matched by the token's <code>kid</code>
                  {typeof jws.header.kid === 'string' ? ` (“${jws.header.kid}”)` : ''}; a private key works too.
                </p>
              </>
            )}
            {result && !result.ok && (
              <p className="error" role="alert">
                {result.error}
              </p>
            )}
            {result?.ok && !result.valid && (
              <p className="jwt-warn">
                {result.note ??
                  (kind === 'hmac'
                    ? 'Wrong secret, or the token was changed after it was signed.'
                    : 'Wrong key, or the token was changed after it was signed.')}
              </p>
            )}
            {shortSecret !== null && (
              <p className="jwt-warn">
                This secret is {shortSecret} bytes; RFC 7518 asks for at least {minSecretBytes(alg!)} for {alg}, so it's
                easier to guess.
              </p>
            )}
          </section>
        )}
      </div>

      <div className="jwt-col">
        <section className="card jwt-card jwt-part jwt-part-header" aria-labelledby={`${ids}-header`}>
          <div className="jwt-head">
            <h2 className="jwt-label jwt-label-header" id={`${ids}-header`}>
              Header
            </h2>
            {header && <CopyButton text={pretty(header)} label="JSON" small />}
          </div>
          {header ? (
            <FieldRows entries={Object.entries(header)} now={now} kind="header" />
          ) : (
            <p className="jwt-placeholder">How the token is signed: algorithm, type and key id.</p>
          )}
        </section>

        <section className="card jwt-card jwt-part jwt-part-payload" aria-labelledby={`${ids}-payload`}>
          <div className="jwt-head">
            <h2 className="jwt-label jwt-label-payload" id={`${ids}-payload`}>
              Payload
            </h2>
            {jws && <CopyButton text={jws.payload === null ? jws.payloadText : pretty(jws.payload)} label="JSON" small />}
          </div>
          {jws ? (
            <>
              <LifetimeBar payload={jws.payload} now={now} />
              {payloadEntries ? (
                payloadEntries.length > 0 ? (
                  <FieldRows entries={payloadEntries} now={now} kind="payload" />
                ) : (
                  <p className="jwt-placeholder">The payload is an empty object.</p>
                )
              ) : (
                <>
                  <p className="hint">The payload isn't a JSON object, so here it is as text:</p>
                  <pre className="jwt-code jwt-raw">{jws.payloadText}</pre>
                </>
              )}
              {payloadEntries && (
                <details className="jwt-fold">
                  <summary>Raw JSON</summary>
                  <pre className="jwt-code jwt-raw">{pretty(jws.payload)}</pre>
                </details>
              )}
            </>
          ) : (
            <p className="jwt-placeholder">
              {jwe ? 'Encrypted: it needs the recipient’s key.' : 'The claims: who it’s for, what it allows and when it expires.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
