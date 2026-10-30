import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { formatDuration, textStats, topWords } from './count'
import './WordCounterTool.css'

type LimitUnit = 'words' | 'characters'
type LimitPreset = 'none' | 'x' | 'meta' | 'custom'

const PRESETS: { value: LimitPreset; label: string; unit?: LimitUnit; max?: number }[] = [
  { value: 'none', label: 'No limit' },
  { value: 'x', label: 'X post · 280', unit: 'characters', max: 280 },
  { value: 'meta', label: 'Meta description · 160', unit: 'characters', max: 160 },
  { value: 'custom', label: 'Custom' },
]

const DRAFT_KEY = 'word-counter:draft'
// Drafts past this size aren't saved, so one huge paste can't fill storage.
const MAX_DRAFT = 200_000
const SAVE_DELAY_MS = 300
const TOP_WORDS = 8

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeDraft(text: string): void {
  try {
    if (text === '' || text.length > MAX_DRAFT) localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, text)
  } catch {
    // Storage unavailable or full: the draft just won't survive a reload.
  }
}

const fmt = new Intl.NumberFormat()

export default function WordCounterTool() {
  const [text, setText] = useState(loadDraft)
  const [preset, setPreset] = useState<LimitPreset>('none')
  const [customUnit, setCustomUnit] = useState<LimitUnit>('words')
  const [customMax, setCustomMax] = useState('500')
  const [skipCommon, setSkipCommon] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const ids = useId()

  // Counting long text on every keystroke would make typing lag; React
  // updates the stats once it has a spare moment instead.
  const deferred = useDeferredValue(text)
  const stats = useMemo(() => textStats(deferred), [deferred])
  const top = useMemo(() => topWords(deferred, TOP_WORDS, skipCommon), [deferred, skipCommon])

  useEffect(() => {
    const id = window.setTimeout(() => storeDraft(deferred), SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [deferred])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const picked = PRESETS.find((p) => p.value === preset)!
  const limit =
    preset === 'custom'
      ? { unit: customUnit, max: Number(customMax) }
      : picked.unit && picked.max
        ? { unit: picked.unit, max: picked.max }
        : null
  const activeLimit = limit && limit.max > 0 ? limit : null
  const used = activeLimit ? (activeLimit.unit === 'words' ? stats.words : stats.characters) : 0
  const over = activeLimit !== null && used > activeLimit.max

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
      setCopied(true)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  const tiles: { label: string; value: string }[] = [
    { label: 'Characters', value: fmt.format(stats.characters) },
    { label: 'Without spaces', value: fmt.format(stats.charactersNoSpaces) },
    { label: 'Sentences', value: fmt.format(stats.sentences) },
    { label: 'Paragraphs', value: fmt.format(stats.paragraphs) },
    { label: 'Lines', value: fmt.format(stats.lines) },
    { label: 'Reading time', value: formatDuration(stats.readingSeconds) },
    { label: 'Speaking time', value: formatDuration(stats.speakingSeconds) },
  ]
  const topMax = top[0]?.count ?? 1

  return (
    <div className="wc-tool">
      <section className="card wc-editor">
        <div className="wc-editor-head">
          <label htmlFor={`${ids}-text`} className="wc-label">
            Your text
          </label>
          <div className="wc-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCopy} disabled={text === ''}>
              <Icon name="copy" size={18} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setText('')} disabled={text === ''}>
              <Icon name="trash" size={18} />
              Clear
            </button>
          </div>
        </div>
        <textarea
          id={`${ids}-text`}
          className="wc-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste something here and watch the numbers go…"
          spellCheck
        />
        {copyFailed && (
          <p className="error" role="alert">
            Couldn't copy automatically. Select the text and copy it by hand.
          </p>
        )}
        <p className="hint">Counted right here in your browser; the text is kept on this device as a draft.</p>
        <p className="sr-only" role="status">
          {copied ? 'Copied to clipboard' : ''}
        </p>
      </section>

      <div className="wc-side">
        <section className="card wc-stats" aria-label="Counts">
          <div className="wc-hero">
            <span className="wc-hero-value">{fmt.format(stats.words)}</span>
            <span className="wc-hero-label">{stats.words === 1 ? 'word' : 'words'}</span>
          </div>
          <dl className="wc-tiles">
            {tiles.map((t) => (
              <div key={t.label} className="wc-tile">
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card wc-limit" aria-labelledby={`${ids}-limit`}>
          <h2 className="wc-label" id={`${ids}-limit`}>
            Keep it under…
          </h2>
          <div className="wc-chips" role="group" aria-labelledby={`${ids}-limit`}>
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="wc-chip"
                aria-pressed={preset === p.value}
                onClick={() => setPreset(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="wc-custom">
              <input
                className="wc-number"
                inputMode="numeric"
                aria-label="Limit"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value.replace(/\D/g, '').slice(0, 7))}
              />
              <div className="wc-chips" role="group" aria-label="Limit unit">
                {(['words', 'characters'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="wc-chip"
                    aria-pressed={customUnit === u}
                    onClick={() => setCustomUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeLimit && (
            <div className={over ? 'wc-meter wc-meter-over' : 'wc-meter'}>
              <div
                className="wc-bar"
                role="meter"
                aria-label={`${activeLimit.unit} used`}
                aria-valuemin={0}
                aria-valuemax={activeLimit.max}
                aria-valuenow={Math.min(used, activeLimit.max)}
              >
                <span style={{ width: `${Math.min(100, (used / activeLimit.max) * 100)}%` }} />
              </div>
              <p className="wc-meter-text">
                <strong>{fmt.format(used)}</strong> / {fmt.format(activeLimit.max)} {activeLimit.unit}
                {' · '}
                {over
                  ? `${fmt.format(used - activeLimit.max)} over`
                  : `${fmt.format(activeLimit.max - used)} left`}
              </p>
            </div>
          )}
        </section>

        <section className="card wc-top" aria-labelledby={`${ids}-top`}>
          <div className="wc-top-head">
            <h2 className="wc-label" id={`${ids}-top`}>
              Top words
            </h2>
            <label className="wc-check">
              <input type="checkbox" checked={skipCommon} onChange={(e) => setSkipCommon(e.target.checked)} />
              Skip "the", "and", "yang"…
            </label>
          </div>
          {top.length === 0 ? (
            <p className="hint">Your most used words show up here.</p>
          ) : (
            <ol className="wc-top-list">
              {top.map((w) => (
                <li key={w.word}>
                  <span className="wc-top-word">{w.word}</span>
                  <span className="wc-top-bar" style={{ width: `${(w.count / topMax) * 100}%` }} />
                  <span className="wc-top-count">{fmt.format(w.count)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
