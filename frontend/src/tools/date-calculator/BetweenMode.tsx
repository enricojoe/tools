import { useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import { countWeekdays, difference, formatCount, formatShort, fromDay, isWeekend, parseIso, plural } from './dates'
import { CopyButton, DateField, HolidayStatus } from './parts'
import { useHolidayDays } from './useHolidayDays'

export interface BetweenState {
  from: string
  to: string
  includeEnd: boolean
}

export function BetweenMode({
  state,
  setState,
  skipHolidays,
  setSkipHolidays,
}: {
  state: BetweenState
  setState: (update: (s: BetweenState) => BetweenState) => void
  skipHolidays: boolean
  setSkipHolidays: (on: boolean) => void
}) {
  const ids = useId()
  const [attempt, setAttempt] = useState(0)
  const set = (patch: Partial<BetweenState>) => setState((s) => ({ ...s, ...patch }))

  const from = parseIso(state.from)
  const to = parseIso(state.to)
  const ready = from !== null && to !== null
  const lookup = useHolidayDays(
    from === null ? 2000 : fromDay(from).y,
    to === null ? 2000 : fromDay(to).y,
    ready && skipHolidays,
    attempt,
  )

  return (
    <div className="dc-mode">
      <section className="card dc-controls" aria-label="Two dates">
        <DateField id={`${ids}-from`} label="From" value={state.from} onChange={(from) => set({ from })} />
        <button
          type="button"
          className="dc-swap"
          onClick={() => set({ from: state.to, to: state.from })}
          aria-label="Swap the two dates"
        >
          <Icon name="swap" size={20} />
        </button>
        <DateField id={`${ids}-to`} label="To" value={state.to} onChange={(to) => set({ to })} />

        <div className="dc-checks">
          <label className="dc-check">
            <input type="checkbox" checked={state.includeEnd} onChange={(e) => set({ includeEnd: e.target.checked })} />
            Count the end day too (+1 day)
          </label>
          <label className="dc-check">
            <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} />
            Leave Indonesian holidays out of working days
          </label>
        </div>
        <p className="hint">
          Without the end day, 1 to 3 January is 2 days, like nights in a hotel. With it, it's 3, like days of a trip.
        </p>
      </section>

      <section className="card dc-answer" aria-live="polite" aria-label="Result">
        {!ready ? (
          <p className="dc-empty">Pick both dates to count the days between them.</p>
        ) : (
          <BetweenAnswer
            from={from}
            to={to}
            includeEnd={state.includeEnd}
            holidays={lookup.status === 'ready' ? lookup.byDay : null}
          />
        )}
        {ready && <HolidayStatus lookup={lookup} onRetry={() => setAttempt((a) => a + 1)} />}
      </section>
    </div>
  )
}

function BetweenAnswer({
  from,
  to,
  includeEnd,
  holidays,
}: {
  from: number
  to: number
  includeEnd: boolean
  holidays: ReadonlyMap<number, unknown> | null
}) {
  const diff = difference(from, to, includeEnd)
  const lo = Math.min(from, to)
  const hi = lo + diff.totalDays
  const weekdays = countWeekdays(lo, hi)
  let holidayDays = 0
  if (holidays) for (const day of holidays.keys()) if (day >= lo && day < hi && !isWeekend(day)) holidayDays++
  const workingDays = weekdays - holidayDays
  const weekendDays = diff.totalDays - weekdays
  const total = diff.totalDays

  const ymd = [
    diff.years && plural(diff.years, 'year'),
    diff.months && plural(diff.months, 'month'),
    (diff.days || (!diff.years && !diff.months)) && plural(diff.days, 'day'),
  ].filter(Boolean).join(', ')

  const tiles = [
    { label: 'Years, months, days', value: ymd },
    { label: 'Weeks and days', value: `${plural(Math.floor(total / 7), 'week')}${total % 7 ? `, ${plural(total % 7, 'day')}` : ''}` },
    { label: 'Whole months', value: plural(diff.totalMonths, 'month') },
    { label: 'Hours', value: formatCount(total * 24) },
    { label: 'Minutes', value: formatCount(total * 1_440) },
    { label: 'Seconds', value: formatCount(total * 86_400) },
  ]

  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100)

  return (
    <>
      <p className="dc-sentence">
        {formatShort(from)} → {formatShort(to)}
      </p>
      <div className="dc-hero" key={`${from}-${to}-${includeEnd}`}>
        <span className="dc-hero-number">{formatCount(total)}</span>
        <span className="dc-hero-unit">{total === 1 ? 'day' : 'days'}</span>
      </div>
      {diff.sign === -1 && <p className="dc-note">The "to" date comes first, so this counts backwards.</p>}

      <dl className="dc-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="dc-tile">
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>

      {total > 0 && (
        <div className="dc-split">
          <div
            className="dc-bar"
            role="img"
            aria-label={`${workingDays} working days, ${weekendDays} weekend days, ${holidayDays} holidays`}
          >
            <span className="dc-bar-work" style={{ width: `${pct(workingDays)}%` }} />
            <span className="dc-bar-holiday" style={{ width: `${pct(holidayDays)}%` }} />
            <span className="dc-bar-weekend" style={{ width: `${pct(weekendDays)}%` }} />
          </div>
          <ul className="dc-legend">
            <li>
              <span className="dc-key dc-bar-work" /> <strong>{formatCount(workingDays)}</strong> working
            </li>
            {holidays && (
              <li>
                <span className="dc-key dc-bar-holiday" /> <strong>{formatCount(holidayDays)}</strong> holiday
                {holidayDays === 1 ? '' : 's'}
              </li>
            )}
            <li>
              <span className="dc-key dc-bar-weekend" /> <strong>{formatCount(weekendDays)}</strong> weekend
            </li>
          </ul>
        </div>
      )}

      <div className="dc-actions">
        <CopyButton text={`${formatCount(total)} ${total === 1 ? 'day' : 'days'} (${ymd})`} label="Copy result" />
      </div>
    </>
  )
}
