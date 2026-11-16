import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { formatMonth, formatWeekday, fromDay, toIso, today } from './dates'
import type { HolidayLookup } from './useHolidayDays'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
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
      // Clipboard blocked: the text is still on screen to select by hand.
    }
  }

  return (
    <button type="button" className="dc-chip" onClick={copy}>
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      <span aria-live="polite">{copied ? 'Copied!' : label}</span>
    </button>
  )
}

/** A row of pill buttons where exactly one is on. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="dc-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A date input with a "Today" shortcut. */
export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (iso: string) => void
}) {
  const todayIso = toIso(today())
  return (
    <div className="dc-field">
      <div className="dc-field-head">
        <label htmlFor={id}>{label}</label>
        <button type="button" className="dc-link" onClick={() => onChange(todayIso)} disabled={value === todayIso}>
          Today
        </button>
      </div>
      <input
        id={id}
        className="dc-input dc-date"
        type="date"
        min="0001-01-01"
        max="9999-12-31"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** A whole-number input with − and + buttons. */
export function Stepper({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (text: string) => void
  invalid: boolean
}) {
  const n = /^\d+$/.test(value.trim()) ? Number(value) : 0
  return (
    <div className="dc-stepper">
      <label htmlFor={id}>{label}</label>
      <div className="dc-stepper-row">
        <button type="button" onClick={() => onChange(String(Math.max(0, n - 1)))} disabled={n <= 0} aria-label={`One fewer ${label.toLowerCase()}`}>
          −
        </button>
        <input
          id={id}
          className="dc-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" onClick={() => onChange(String(n + 1))} aria-label={`One more ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  )
}

/** A tear-off calendar page for one day; it pops in again whenever the day changes. */
export function CalendarSheet({ day, tone = 'accent' }: { day: number; tone?: 'accent' | 'holiday' | 'weekend' }) {
  const { y, d } = fromDay(day)
  return (
    <div className={`dc-sheet dc-sheet-${tone}`} key={day} aria-hidden="true">
      <span className="dc-sheet-rings" />
      <span className="dc-sheet-top">
        {formatMonth(day)} {y}
      </span>
      <span className="dc-sheet-day">{d}</span>
      <span className="dc-sheet-weekday">{formatWeekday(day)}</span>
    </div>
  )
}

/** Status of the holiday lookup, under a working-days answer. */
export function HolidayStatus({ lookup, onRetry }: { lookup: HolidayLookup; onRetry: () => void }) {
  if (lookup.status === 'off') return <p className="hint">Only Saturdays and Sundays are skipped.</p>
  if (lookup.status === 'loading') return <p className="hint">Checking Indonesian holidays…</p>
  if (lookup.status === 'error') {
    return (
      <div className="dc-note dc-note-warn" role="alert">
        <p>Couldn't load the holidays ({lookup.message}), so only weekends are skipped.</p>
        <button type="button" className="dc-chip" onClick={onRetry}>
          <Icon name="reset" size={14} />
          Try again
        </button>
      </div>
    )
  }
  if (!lookup.partial) {
    return <p className="hint">Weekends, Indonesian public holidays and cuti bersama are skipped.</p>
  }
  const { available } = lookup
  const covered = available.length === 0 ? null : `${available[0]}–${available[available.length - 1]}`
  return (
    <p className="hint">
      {covered
        ? `Indonesian holidays are known for ${covered}; outside those years only weekends are skipped.`
        : 'There is no holiday list yet, so only weekends are skipped.'}
    </p>
  )
}
