import { useEffect, useId, useRef, useState } from 'react'
import { MAX_COUNT, fetchLorem, type LoremResult, type LoremUnit } from '../../api/lorem'
import { Icon } from '../../components/Icon'
import './LoremIpsumTool.css'

type Format = 'text' | 'html'

const UNITS: { value: LoremUnit; label: string }[] = [
  { value: 'paragraphs', label: 'Paragraphs' },
  { value: 'sentences', label: 'Sentences' },
  { value: 'words', label: 'Words' },
]

const DEFAULT_COUNT: Record<LoremUnit, number> = { paragraphs: 3, sentences: 5, words: 50 }
const DEBOUNCE_MS = 250

/** Keeps digits only and clamps to `max`; '' stays '' so the field can be cleared. */
function clampCount(value: string, max: number): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits === '' ? '' : String(Math.min(Number(digits), max))
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatOutput(paragraphs: string[], format: Format): string {
  if (format === 'html') return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')
  return paragraphs.join('\n\n')
}

export default function LoremIpsumTool() {
  const [unit, setUnit] = useState<LoremUnit>('paragraphs')
  const [count, setCount] = useState(String(DEFAULT_COUNT.paragraphs))
  const [startWithLorem, setStartWithLorem] = useState(true)
  const [format, setFormat] = useState<Format>('text')
  // undefined asks the server for a fresh random seed; option changes keep
  // the current one so the text only grows or shrinks.
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [result, setResult] = useState<LoremResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const ids = useId()

  const max = MAX_COUNT[unit]
  const countNum = Number(count)
  const validCount = count !== '' && countNum >= 1 && countNum <= max

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  useEffect(() => {
    if (!validCount) return
    const controller = new AbortController()
    const id = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchLorem({ unit, count: countNum, startWithLorem, seed }, controller.signal)
        setResult(res)
        if (seed === undefined) setSeed(res.seed)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(id)
      controller.abort()
    }
  }, [unit, countNum, validCount, startWithLorem, seed, retry])

  function pickUnit(next: LoremUnit) {
    setUnit(next)
    setCount(String(DEFAULT_COUNT[next]))
  }

  const output = result ? formatOutput(result.paragraphs, format) : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(output)
      setCopyFailed(false)
      setCopied(true)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="lorem-tool">
      <form className="card form lorem-options" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <span className="lorem-label" id={`${ids}-unit`}>
            Make me some…
          </span>
          <div className="lorem-chips" role="group" aria-labelledby={`${ids}-unit`}>
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                className="lorem-chip"
                aria-pressed={unit === u.value}
                onClick={() => pickUnit(u.value)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${ids}-count`}>How many?</label>
          <div className="lorem-count">
            <input
              id={`${ids}-count`}
              className="lorem-count-input"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(clampCount(e.target.value, max))}
              aria-invalid={!validCount}
              aria-describedby={`${ids}-count-hint`}
            />
            <input
              type="range"
              className="lorem-range"
              min={1}
              max={max}
              value={validCount ? countNum : 1}
              onChange={(e) => setCount(e.target.value)}
              aria-label={`Number of ${unit}`}
            />
          </div>
          <p id={`${ids}-count-hint`} className={validCount ? 'hint' : 'hint hint-error'}>
            {validCount ? `1 to ${max} ${unit}` : `Pick a number from 1 to ${max}`}
          </p>
        </div>

        <label className="lorem-check">
          <input
            type="checkbox"
            checked={startWithLorem}
            onChange={(e) => setStartWithLorem(e.target.checked)}
          />
          Start with “Lorem ipsum dolor sit amet…”
        </label>

        <div className="field">
          <span className="lorem-label" id={`${ids}-format`}>
            Format
          </span>
          <div className="lorem-chips" role="group" aria-labelledby={`${ids}-format`}>
            <button
              type="button"
              className="lorem-chip"
              aria-pressed={format === 'text'}
              onClick={() => setFormat('text')}
            >
              Plain text
            </button>
            <button
              type="button"
              className="lorem-chip"
              aria-pressed={format === 'html'}
              onClick={() => setFormat('html')}
            >
              HTML &lt;p&gt;
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!validCount}
          onClick={() => setSeed(undefined)}
        >
          <Icon name="reset" size={18} />
          Shuffle the words
        </button>
      </form>

      <section className="card lorem-output" aria-label="Generated text" aria-busy={loading}>
        <div className="lorem-output-head">
          <p className="lorem-stats">
            {result ? (
              <>
                <strong>{result.paragraphs.length}</strong> {result.paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}
                {' · '}
                <strong>{result.words}</strong> words
                {' · '}
                <strong>{output.length}</strong> characters
              </>
            ) : (
              'Warming up the Latin…'
            )}
          </p>
          <button type="button" className="btn btn-secondary" onClick={handleCopy} disabled={!result}>
            <Icon name="copy" size={18} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {error && (
          <div className="error lorem-error" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}
        {copyFailed && (
          <p className="error" role="alert">
            Couldn't copy automatically. Select the text and copy it by hand.
          </p>
        )}

        {result &&
          (format === 'html' ? (
            <pre className="lorem-text lorem-html">{output}</pre>
          ) : (
            <div className="lorem-text">
              {result.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ))}
        <p className="sr-only" role="status">
          {copied ? 'Copied to clipboard' : ''}
        </p>
      </section>
    </div>
  )
}
