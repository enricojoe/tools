import { useId } from 'react'
import { Icon } from '../../components/Icon'
import {
  DURATION_UNITS,
  YEAR_BASES,
  breakdown,
  convertDuration,
  formatAmount,
  parseAmount,
  plural,
  type Breakdown,
  type DurationUnit,
  type YearBasis,
} from './dates'
import { CopyButton, Segmented } from './parts'

export interface ConvertState {
  value: string
  unit: DurationUnit
  basis: YearBasis
}

const EXAMPLES: { value: string; unit: DurationUnit }[] = [
  { value: '1', unit: 'year' },
  { value: '1', unit: 'month' },
  { value: '100', unit: 'day' },
  { value: '6', unit: 'week' },
  { value: '1000000', unit: 'second' },
]

/** Units "Count it from today" can add on the calendar, and how. */
const CALENDAR_UNITS: Partial<Record<DurationUnit, { field: 'days' | 'weeks' | 'months' | 'years'; times: number }>> = {
  day: { field: 'days', times: 1 },
  week: { field: 'weeks', times: 1 },
  month: { field: 'months', times: 1 },
  year: { field: 'years', times: 1 },
  decade: { field: 'years', times: 10 },
}

function unitWord(unit: DurationUnit, n: number): string {
  const label = DURATION_UNITS.find((u) => u.id === unit)!.label.toLowerCase()
  return n === 1 ? label.slice(0, -1) : label
}

function sentence(parts: Breakdown): string {
  const words = parts.map((p) => `${formatAmount(p.count)} ${unitWord(p.unit, p.count)}`)
  return words.length <= 1 ? (words[0] ?? '0 seconds') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

export function ConvertMode({
  state,
  setState,
  onCountFromToday,
}: {
  state: ConvertState
  setState: (update: (s: ConvertState) => ConvertState) => void
  onCountFromToday: (field: 'days' | 'weeks' | 'months' | 'years', amount: number) => void
}) {
  const ids = useId()
  const set = (patch: Partial<ConvertState>) => setState((s) => ({ ...s, ...patch }))

  const value = parseAmount(state.value)
  const basis = YEAR_BASES.find((b) => b.id === state.basis) ?? YEAR_BASES[0]
  const results = value === null ? null : convertDuration(value, state.unit, basis.days)
  const parts = value === null ? null : breakdown(value, state.unit, basis.days)
  const source = `${formatAmount(value ?? 0)} ${unitWord(state.unit, value ?? 0)}`
  const calendar = CALENDAR_UNITS[state.unit]
  const countable = calendar && value !== null && value > 0 && Number.isInteger(value) && value * calendar.times <= 9_999

  return (
    <div className="dc-mode">
      <section className="card dc-controls" aria-label="Duration">
        <div className="dc-field">
          <label htmlFor={`${ids}-value`}>How long?</label>
          <input
            id={`${ids}-value`}
            className="dc-input dc-big-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={state.value}
            aria-invalid={value === null && state.value.trim() !== ''}
            onChange={(e) => set({ value: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="dc-unit-chips" role="group" aria-label="Unit">
          {DURATION_UNITS.map((u) => (
            <button key={u.id} type="button" aria-pressed={u.id === state.unit} onClick={() => set({ unit: u.id })}>
              {u.label}
            </button>
          ))}
        </div>
        {value === null && (
          <p className="hint hint-error">
            {state.value.trim() === '' ? 'Type an amount, like 1 or 2.5.' : 'Use a positive number, like 1 or 2.5.'}
          </p>
        )}

        <div className="dc-field">
          <span className="dc-field-label">Days in a year</span>
          <Segmented
            label="Length of a year"
            value={state.basis}
            onChange={(b) => set({ basis: b })}
            options={YEAR_BASES.map((b) => ({ value: b.id, label: b.label }))}
          />
          <p className="hint">{basis.hint} A month is a twelfth of a year ({formatAmount(basis.days / 12)} days).</p>
        </div>

        <div className="dc-quick">
          <span className="dc-quick-label">Try</span>
          <div className="dc-quick-chips">
            {EXAMPLES.map((e) => (
              <button
                key={`${e.value}-${e.unit}`}
                type="button"
                className="dc-chip"
                onClick={() => set({ value: e.value, unit: e.unit })}
              >
                {formatAmount(Number(e.value))} {unitWord(e.unit, Number(e.value))}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card dc-answer" aria-live="polite" aria-label="Result">
        {results === null ? (
          <p className="dc-empty">Type an amount to convert it.</p>
        ) : (
          <>
            <p className="dc-sentence">{source} is</p>
            {parts !== null && parts.length > 0 && (
              <p className="dc-breakdown" key={`${state.value}-${state.unit}-${state.basis}`}>
                {sentence(parts)}
              </p>
            )}
            <ul className="dc-units">
              {DURATION_UNITS.map((u) => {
                const n = results[u.id]
                const text = formatAmount(n)
                return (
                  <li key={u.id} className={u.id === state.unit ? 'dc-unit dc-unit-source' : 'dc-unit'}>
                    <button
                      type="button"
                      className="dc-unit-pick"
                      onClick={() => set({ value: String(Number(n.toPrecision(12))), unit: u.id })}
                      title={`Convert from ${u.label.toLowerCase()} instead`}
                    >
                      <span className="dc-unit-value">{text}</span>
                      <span className="dc-unit-name">{unitWord(u.id, n)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="dc-actions">
              <CopyButton text={parts && parts.length > 0 ? `${source} = ${sentence(parts)}` : source} label="Copy" />
              {countable && (
                <button
                  type="button"
                  className="dc-chip dc-chip-go"
                  onClick={() => onCountFromToday(calendar.field, value * calendar.times)}
                >
                  <Icon name="datecalc" size={15} />
                  What date is {plural(value, unitWord(state.unit, 1))} from today?
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
