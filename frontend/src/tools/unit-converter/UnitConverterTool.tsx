import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '../../components/Icon'
import type { Conversion, UnitCategory } from '../../api/units'
import { formatNumber, formatPlain, loadStored, parseInput, pairFor, storeStored, type UnitPair } from './format'
import { categoryIcon } from './comparisons'
import { Perspective } from './Perspective'
import { useConversion, useUnitCategories } from './useUnits'
import './UnitConverterTool.css'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the value is still on screen to select by hand.
    }
  }

  return (
    <button type="button" className="uc-copy" onClick={copy} aria-label="Copy result">
      <Icon name="copy" size={16} />
      <span aria-live="polite">{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  )
}

function CategoryPicker({
  categories,
  current,
  onPick,
}: {
  categories: UnitCategory[]
  current: string
  onPick: (id: string) => void
}) {
  return (
    <div role="group" aria-label="Category" className="uc-cats">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className="uc-cat"
          aria-pressed={c.id === current}
          onClick={() => onPick(c.id)}
        >
          <Icon name={categoryIcon(c.id)} size={22} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}

function UnitChips({
  label,
  units,
  current,
  onPick,
}: {
  label: string
  units: UnitCategory['units']
  current: string
  onPick: (id: string) => void
}) {
  return (
    <div role="group" aria-label={label} className="uc-chips">
      {units.map((u) => (
        <button
          key={u.id}
          type="button"
          className="uc-chip"
          aria-pressed={u.id === current}
          title={u.name}
          aria-label={`${u.name} (${u.symbol})`}
          onClick={() => onPick(u.id)}
        >
          {u.symbol}
        </button>
      ))}
    </div>
  )
}

/** Bar widths (%) on a log scale, so each unit's number is shown by its size. */
function magnitudes(values: number[]): number[] | null {
  const logs = values.map((v) => (v === 0 || !Number.isFinite(v) ? null : Math.log10(Math.abs(v))))
  const known = logs.filter((l): l is number => l !== null)
  if (known.length < 2) return null
  const min = Math.min(...known)
  const span = Math.max(...known) - min
  return logs.map((l) => (l === null ? 0 : span === 0 ? 100 : 12 + (88 * (l - min)) / span))
}

function Converter({ categories }: { categories: UnitCategory[] }) {
  const [stored, setStored] = useState(loadStored)
  const [text, setText] = useState('1')
  const [attempt, setAttempt] = useState(0)
  const [turns, setTurns] = useState(0)

  const category = categories.find((c) => c.id === stored.category) ?? categories[0]
  const { from, to } = pairFor(category, stored.pairs[category.id])
  const value = parseInput(text)

  const { conversion, error } = useConversion(category.id, from, value, attempt)

  useEffect(() => storeStored(stored), [stored])

  function setPair(pair: UnitPair) {
    setStored((s) => ({ ...s, pairs: { ...s.pairs, [category.id]: pair } }))
  }

  function swap() {
    setPair({ from: to, to: from })
    setTurns((t) => t + 1)
  }

  function nudge(change: (n: number) => number) {
    if (value === null) return
    setText(formatPlain(change(Number(value))))
  }

  function flipSign() {
    const t = text.trim()
    setText(t.startsWith('-') ? t.slice(1) : `-${t.replace(/^\+/, '')}`)
  }

  const symbolOf = (id: string) => category.units.find((u) => u.id === id)?.symbol ?? id
  const nameOf = (id: string) => category.units.find((u) => u.id === id)?.name ?? id

  // The answer on screen is only current if it matches what is asked right now.
  const fresh =
    conversion !== null &&
    value !== null &&
    conversion.category === category.id &&
    conversion.from === from &&
    conversion.value === Number(value)
  const shown: Conversion | null = conversion !== null && conversion.category === category.id ? conversion : null
  const main = shown?.results.find((r) => r.unit === to)
  const valueIn = (unit: string) => shown?.results.find((r) => r.unit === unit)?.value
  const bars = shown !== null && category.id !== 'temperature' ? magnitudes(shown.results.map((r) => r.value)) : null

  return (
    <div className="unit-tool">
      <CategoryPicker
        categories={categories}
        current={category.id}
        onPick={(id) => setStored((s) => ({ ...s, category: id }))}
      />

      <section className="uc-ticket" aria-label="Unit converter">
        <div className="card uc-panel uc-from">
          <div className="uc-panel-head">
            <label htmlFor="uc-value" className="uc-panel-tag">
              From
            </label>
            <span className="uc-panel-unit">{nameOf(from)}</span>
          </div>
          <div className="uc-value-row">
            <input
              id="uc-value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={value === null && text.trim() !== ''}
              aria-describedby="uc-hint"
            />
            <span className="uc-value-symbol" aria-hidden="true">
              {symbolOf(from)}
            </span>
          </div>
          <div className="uc-nudges">
            <button type="button" className="uc-nudge" onClick={() => nudge((n) => n / 10)} disabled={value === null}>
              ÷10
            </button>
            <button type="button" className="uc-nudge" onClick={() => nudge((n) => n * 10)} disabled={value === null}>
              ×10
            </button>
            <button type="button" className="uc-nudge" onClick={flipSign} disabled={value === null} aria-label="Flip the sign">
              ±
            </button>
          </div>
          <UnitChips label="From unit" units={category.units} current={from} onPick={(id) => setPair({ from: id, to })} />
          <p id="uc-hint" className={value === null ? 'hint hint-error' : 'hint'} role="status">
            {value === null
              ? text.trim() === ''
                ? 'Type a number to convert.'
                : 'That does not look like a number. Try something like 12.5 or -40 (up to 1e15).'
              : ' '}
          </p>
        </div>

        <button
          type="button"
          className="uc-swap"
          onClick={swap}
          aria-label="Swap from and to units"
          style={{ '--turns': turns } as CSSProperties}
        >
          <Icon name="swap" size={22} />
        </button>

        <div className="card uc-panel uc-to" data-stale={!fresh} aria-busy={value !== null && !fresh}>
          <div className="uc-panel-head">
            <span className="uc-panel-tag">To</span>
            <span className="uc-panel-unit">{nameOf(to)}</span>
          </div>

          {error !== null && (
            <div className="error" role="alert">
              <p>
                {shown === null
                  ? `Couldn't convert this (${error}).`
                  : `Couldn't refresh the result (${error}). What you see is for an earlier value.`}
              </p>
              <button type="button" className="btn btn-secondary retry-btn" onClick={() => setAttempt((a) => a + 1)}>
                <Icon name="reset" size={16} />
                Try again
              </button>
            </div>
          )}

          {main !== undefined && value !== null ? (
            <div className="uc-result">
              <output key={`${to}:${main.value}`} className="uc-result-value" aria-label={`Result in ${nameOf(to)}`}>
                {formatNumber(main.value)}
              </output>
              <span className="uc-value-symbol">{symbolOf(to)}</span>
              <CopyButton text={formatPlain(main.value)} />
            </div>
          ) : (
            error === null && (
              <p className="uc-result uc-result-empty" role="status">
                {value === null ? '?' : 'Converting…'}
              </p>
            )
          )}

          <UnitChips label="To unit" units={category.units} current={to} onPick={(id) => setPair({ from, to: id })} />
          {main !== undefined && value !== null && (
            <p className="uc-sentence">
              {formatNumber(shown?.value ?? 0)} {nameOf(shown?.from ?? from).toLowerCase()} is{' '}
              {formatNumber(main.value)} {nameOf(to).toLowerCase()}.
            </p>
          )}
        </div>
      </section>

      {shown !== null && value !== null && <Perspective category={category.id} valueIn={valueIn} />}

      {shown !== null && value !== null && (
        <section className="card uc-all" data-stale={!fresh} aria-labelledby="uc-all-title">
          <h2 id="uc-all-title" className="section-title">
            Every {category.name.toLowerCase()} unit
          </h2>
          <ul className="uc-list">
            {shown.results.map((r, i) => (
              <li key={r.unit}>
                <button
                  type="button"
                  className="uc-row"
                  aria-pressed={r.unit === to}
                  data-from={r.unit === shown.from}
                  onClick={() => setPair({ from, to: r.unit })}
                  aria-label={`${formatNumber(r.value)} ${nameOf(r.unit)}. Set as the to unit`}
                  style={bars === null ? undefined : ({ '--bar': `${bars[i]}%` } as CSSProperties)}
                >
                  <span className="uc-row-name">
                    {nameOf(r.unit)}
                    {r.unit === shown.from && <span className="uc-row-badge">from</span>}
                  </span>
                  <span className="uc-row-value">
                    {formatNumber(r.value)} <span className="uc-row-symbol">{symbolOf(r.unit)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {bars !== null && <p className="hint">Bars show each number's size on a log scale.</p>}
        </section>
      )}
    </div>
  )
}

export default function UnitConverterTool() {
  const [attempt, setAttempt] = useState(0)
  const { categories, error } = useUnitCategories(attempt)

  if (categories === null || categories.length === 0) {
    return (
      <div className="unit-tool">
        <section className="card uc-card" aria-label="Unit converter">
          {error !== null ? (
            <div className="error" role="alert">
              <p>Couldn't load the units ({error}).</p>
              <button type="button" className="btn btn-secondary retry-btn" onClick={() => setAttempt((a) => a + 1)}>
                <Icon name="reset" size={16} />
                Try again
              </button>
            </div>
          ) : (
            <p className="muted" role="status">
              {categories === null ? 'Loading units…' : 'No units available.'}
            </p>
          )}
        </section>
      </div>
    )
  }

  return <Converter categories={categories} />
}
