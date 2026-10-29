import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { Conversion, UnitCategory } from '../../api/units'
import { formatNumber, formatPlain, loadStored, parseInput, pairFor, storeStored, type UnitPair } from './format'
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

function Converter({ categories }: { categories: UnitCategory[] }) {
  const [stored, setStored] = useState(loadStored)
  const [text, setText] = useState('1')
  const [attempt, setAttempt] = useState(0)

  const category = categories.find((c) => c.id === stored.category) ?? categories[0]
  const { from, to } = pairFor(category, stored.pairs[category.id])
  const value = parseInput(text)

  const { conversion, error } = useConversion(category.id, from, value, attempt)

  useEffect(() => storeStored(stored), [stored])

  function setPair(pair: UnitPair) {
    setStored((s) => ({ ...s, pairs: { ...s.pairs, [category.id]: pair } }))
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

  return (
    <div className="unit-tool">
      <section className="card uc-card" aria-label="Unit converter">
        <div role="tablist" aria-label="Category" className="uc-tabs">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === category.id}
              className="uc-tab"
              onClick={() => setStored((s) => ({ ...s, category: c.id }))}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="uc-inputs">
          <div className="field uc-value">
            <label htmlFor="uc-value">Value</label>
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
          </div>

          <div className="uc-units">
            <div className="field">
              <label htmlFor="uc-from">From</label>
              <select id="uc-from" value={from} onChange={(e) => setPair({ from: e.target.value, to })}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-secondary uc-swap"
              onClick={() => setPair({ from: to, to: from })}
              aria-label="Swap from and to units"
            >
              <Icon name="swap" size={18} />
            </button>
            <div className="field">
              <label htmlFor="uc-to">To</label>
              <select id="uc-to" value={to} onChange={(e) => setPair({ from, to: e.target.value })}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p id="uc-hint" className={value === null ? 'hint hint-error' : 'hint'} role="status">
          {value === null
            ? text.trim() === ''
              ? 'Type a number to convert.'
              : 'That does not look like a number. Try something like 12.5 or -40 (up to 1e15).'
            : ' '}
        </p>

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

        {main !== undefined && value !== null && (
          <div className="uc-main" data-stale={!fresh} aria-busy={!fresh}>
            <p className="uc-main-from">
              {formatNumber(shown?.value ?? 0)} {symbolOf(shown?.from ?? from)} =
            </p>
            <p className="uc-main-value">
              <output aria-label={`Result in ${nameOf(to)}`}>{formatNumber(main.value)}</output>
              <span className="uc-main-unit">{symbolOf(to)}</span>
              <CopyButton text={formatPlain(main.value)} />
            </p>
          </div>
        )}
        {main === undefined && value !== null && error === null && (
          <p className="muted" role="status">
            Converting…
          </p>
        )}
      </section>

      {shown !== null && value !== null && (
        <section className="card uc-all" data-stale={!fresh} aria-labelledby="uc-all-title">
          <h2 id="uc-all-title" className="section-title">
            Every {category.name.toLowerCase()} unit
          </h2>
          <ul className="uc-list">
            {shown.results.map((r) => (
              <li key={r.unit}>
                <button
                  type="button"
                  className="uc-row"
                  aria-pressed={r.unit === to}
                  onClick={() => setPair({ from, to: r.unit })}
                  aria-label={`${formatNumber(r.value)} ${nameOf(r.unit)}. Set as the to unit`}
                >
                  <span className="uc-row-name">{nameOf(r.unit)}</span>
                  <span className="uc-row-value">
                    {formatNumber(r.value)} <span className="uc-row-symbol">{symbolOf(r.unit)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
