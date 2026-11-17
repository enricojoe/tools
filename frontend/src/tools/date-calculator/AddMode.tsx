import { useId, useState } from 'react'
import type { Holiday } from '../../api/holidays'
import { Icon } from '../../components/Icon'
import {
  MAX_WORKING_DAYS,
  addAmounts,
  addWorkingDays,
  dateFacts,
  formatCount,
  formatLong,
  formatShort,
  fromDay,
  isWeekend,
  parseIso,
  parseWhole,
  plural,
  relativeDays,
  toIso,
  today,
  type Amounts,
} from './dates'
import { CalendarSheet, CopyButton, DateField, HolidayStatus, Segmented, Stepper } from './parts'
import { holidayKind, useHolidayDays } from './useHolidayDays'
import type { AddState } from './state'

const FIELDS = [
  { key: 'years', label: 'Years', max: 9_999 },
  { key: 'months', label: 'Months', max: 120_000 },
  { key: 'weeks', label: 'Weeks', max: 530_000 },
  { key: 'days', label: 'Days', max: 3_700_000 },
] as const

const QUICK: { label: string; amounts: Partial<Amounts> }[] = [
  { label: '1 day', amounts: { days: 1 } },
  { label: '10 days', amounts: { days: 10 } },
  { label: '1 week', amounts: { weeks: 1 } },
  { label: '5 weeks', amounts: { weeks: 5 } },
  { label: '30 days', amounts: { days: 30 } },
  { label: '1 month', amounts: { months: 1 } },
  { label: '6 months', amounts: { months: 6 } },
  { label: '100 days', amounts: { days: 100 } },
  { label: '1 year', amounts: { years: 1 } },
]

/** "1 year, 2 months and 5 days"; "nothing" when every amount is 0. */
function describe(a: Amounts): string {
  const parts = [
    a.years && plural(a.years, 'year'),
    a.months && plural(a.months, 'month'),
    a.weeks && plural(a.weeks, 'week'),
    a.days && plural(a.days, 'day'),
  ].filter(Boolean) as string[]
  if (parts.length === 0) return 'nothing'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function AddMode({
  state,
  setState,
  skipHolidays,
  setSkipHolidays,
}: {
  state: AddState
  setState: (update: (s: AddState) => AddState) => void
  skipHolidays: boolean
  setSkipHolidays: (on: boolean) => void
}) {
  const ids = useId()
  const [attempt, setAttempt] = useState(0)
  const set = (patch: Partial<AddState>) => setState((s) => ({ ...s, ...patch }))

  const start = parseIso(state.start)
  const amounts = Object.fromEntries(FIELDS.map((f) => [f.key, parseWhole(state[f.key], f.max)])) as Record<
    keyof Amounts,
    number | null
  >
  const working = parseWhole(state.working, MAX_WORKING_DAYS)
  const isWorking = state.count === 'working'

  // Years the working-day walk can reach: about 7 calendar days per 5 working days, plus holidays.
  const startYear = start === null ? 2000 : fromDay(start).y
  const reach = Math.ceil((working ?? 0) * 1.6 + 40)
  const endYear = start === null ? startYear : fromDay(start + state.sign * reach).y
  const lookup = useHolidayDays(startYear, endYear, isWorking && skipHolidays && start !== null, attempt)
  const holidays = lookup.status === 'ready' ? lookup.byDay : null

  const result = (() => {
    if (start === null) return null
    if (isWorking) {
      if (working === null) return null
      const isOff = (day: number) => isWeekend(day) || (holidays?.has(day) ?? false)
      const walked = addWorkingDays(start, working, state.sign, isOff)
      if (walked === null) return { outOfRange: true as const }
      const passed: number[] = []
      if (holidays) {
        const [lo, hi] = state.sign === 1 ? [start + 1, walked.day] : [walked.day, start - 1]
        for (const day of holidays.keys()) if (day >= lo && day <= hi && !isWeekend(day)) passed.push(day)
      }
      return { day: walked.day, clamped: null, skipped: walked.skipped, passed: passed.sort((a, b) => a - b) }
    }
    if (Object.values(amounts).some((v) => v === null)) return null
    const added = addAmounts(start, amounts as Amounts, state.sign)
    return added === null ? { outOfRange: true as const } : { ...added, skipped: 0, passed: [] }
  })()

  const what = isWorking
    ? working === null
      ? ''
      : plural(working, 'working day')
    : describe(amounts as Amounts)

  function quick(preset: Partial<Amounts>) {
    set({
      count: 'calendar',
      years: String(preset.years ?? ''),
      months: String(preset.months ?? ''),
      weeks: String(preset.weeks ?? ''),
      days: String(preset.days ?? ''),
    })
  }

  const signText = state.sign === 1 ? '+' : '−'

  return (
    <div className="dc-mode">
      <section className="card dc-controls" aria-label="Start date and amount">
        <DateField id={`${ids}-start`} label="Start date" value={state.start} onChange={(start) => set({ start })} />

        <div className="dc-row">
          <Segmented
            label="Add or subtract"
            value={state.sign}
            onChange={(sign) => set({ sign })}
            options={[
              { value: 1, label: <><Icon name="plus" size={16} /> Add</> },
              { value: -1, label: <><span className="dc-minus" aria-hidden="true">−</span> Subtract</> },
            ]}
          />
          <Segmented
            label="What to count"
            value={state.count}
            onChange={(count) => set({ count })}
            options={[
              { value: 'calendar', label: 'Calendar days' },
              { value: 'working', label: 'Working days' },
            ]}
          />
        </div>

        {isWorking ? (
          <div className="dc-working">
            <Stepper
              id={`${ids}-working`}
              label="Working days"
              value={state.working}
              onChange={(working) => set({ working })}
              invalid={working === null}
            />
            <label className="dc-check">
              <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} />
              Skip Indonesian holidays and cuti bersama
            </label>
            {working === null && <p className="hint hint-error">Use a whole number up to {formatCount(MAX_WORKING_DAYS)}.</p>}
          </div>
        ) : (
          <>
            <div className="dc-steppers">
              {FIELDS.map((f) => (
                <Stepper
                  key={f.key}
                  id={`${ids}-${f.key}`}
                  label={f.label}
                  value={state[f.key]}
                  onChange={(text) => set({ [f.key]: text })}
                  invalid={amounts[f.key] === null}
                />
              ))}
            </div>
            {Object.values(amounts).some((v) => v === null) && (
              <p className="hint hint-error">Amounts are whole numbers; use Subtract to go back in time.</p>
            )}
          </>
        )}

        <div className="dc-quick">
          <span className="dc-quick-label">Quick picks</span>
          <div className="dc-quick-chips">
            {QUICK.map((q) => (
              <button key={q.label} type="button" className="dc-chip" onClick={() => quick(q.amounts)}>
                {signText}
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card dc-answer" aria-live="polite" aria-label="Result">
        {start === null ? (
          <p className="dc-empty">Pick a start date to begin.</p>
        ) : result === null ? (
          <p className="dc-empty">Fix the amount to see the date.</p>
        ) : 'outOfRange' in result ? (
          <p className="dc-empty">That lands outside years 1–9999. Try a smaller amount.</p>
        ) : (
          <AddAnswer
            start={start}
            day={result.day}
            sentence={`${formatShort(start)} ${signText} ${what}`}
            clamped={result.clamped}
            skipped={isWorking ? result.skipped : null}
            passed={result.passed}
            holidays={holidays}
            onChain={() => set({ start: toIso(result.day) })}
          />
        )}
        {isWorking && start !== null && <HolidayStatus lookup={lookup} onRetry={() => setAttempt((a) => a + 1)} />}
      </section>
    </div>
  )
}

function AddAnswer({
  start,
  day,
  sentence,
  clamped,
  skipped,
  passed,
  holidays,
  onChain,
}: {
  start: number
  day: number
  sentence: string
  clamped: { from: number; to: number } | null
  skipped: number | null
  passed: number[]
  holidays: ReadonlyMap<number, Holiday> | null
  onChain: () => void
}) {
  const facts = dateFacts(day)
  const holiday = holidays?.get(day)
  const weekend = isWeekend(day)
  const fromToday = day - today()

  return (
    <>
      <p className="dc-sentence">{sentence} =</p>
      <div className="dc-sheet-wrap">
        <CalendarSheet day={day} tone={holiday ? 'holiday' : weekend ? 'weekend' : 'accent'} />
        <div className="dc-sheet-side">
          <p className="dc-long">{formatLong(day)}</p>
          <p className="dc-relative">
            <span className="dc-badge">{relativeDays(fromToday)}</span>
            {day !== start && start !== today() && <span className="hint">{plural(Math.abs(day - start), 'day')} from the start</span>}
          </p>
          <ul className="dc-facts" aria-label="About this date">
            <li>
              Week {facts.isoWeek}
              {facts.isoWeekYear !== fromDay(day).y && ` of ${facts.isoWeekYear}`}
            </li>
            <li>
              Day {facts.dayOfYear} of {facts.daysInYear}
            </li>
            <li>Q{facts.quarter}</li>
          </ul>
        </div>
      </div>

      {holiday && (
        <p className="dc-note dc-note-holiday">
          <Icon name="flag" size={16} />
          <span>
            <strong>{holiday.name}</strong> · {holidayKind(holiday)}
          </span>
        </p>
      )}
      {!holiday && weekend && skipped === null && <p className="dc-note">It falls on a weekend.</p>}
      {clamped && (
        <p className="dc-note">
          That month has no day {clamped.from}, so it stops at its last day, the {clamped.to}th.
        </p>
      )}
      {skipped !== null && skipped > 0 && (
        <div className="dc-note">
          <p>
            Skipped {plural(skipped, 'day')} off
            {passed.length > 0 && `, ${passed.length === 1 ? 'one of them a holiday' : `${passed.length} of them holidays`}`}.
          </p>
          {passed.length > 0 && (
            <ul className="dc-passed">
              {passed.slice(0, 6).map((d) => (
                <li key={d}>
                  {formatShort(d)}: {holidays?.get(d)?.name}
                </li>
              ))}
              {passed.length > 6 && <li>and {passed.length - 6} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="dc-actions">
        <CopyButton text={formatLong(day)} label="Copy date" />
        <button type="button" className="dc-chip" onClick={onChain}>
          <Icon name="arrow" size={15} />
          Start from here
        </button>
      </div>
    </>
  )
}
