import { useMemo, useState } from 'react'
import type { Holiday } from '../../api/holidays'
import { Icon } from '../../components/Icon'
import {
  WEEKDAYS,
  addMonths,
  daysBetween,
  formatLongDate,
  formatMonth,
  formatShortDate,
  isoDate,
  monthGrid,
  todayIso,
  type YearMonth,
} from './calendarDate'
import { useHolidays } from './useHolidays'
import './CalendarTool.css'

const TYPE_LABEL: Record<Holiday['type'], string> = {
  national: 'Public holiday',
  collective_leave: 'Cuti bersama',
}

/** "today", "tomorrow", "in 12 days", "3 days ago" */
function relativeDays(n: number): string {
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

function yearRange(years: number[]): string {
  if (years.length === 0) return 'no years yet'
  return years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`
}

export default function CalendarTool() {
  const today = todayIso()
  const [view, setView] = useState<YearMonth>(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const { state, retry } = useHolidays(view.year)

  const data = state.status === 'ready' ? state.data : null
  const hasData = data !== null && data.availableYears.includes(view.year)

  const byDate = useMemo(() => {
    const m = new Map<string, Holiday[]>()
    for (const h of data?.holidays ?? []) m.set(h.date, [...(m.get(h.date) ?? []), h])
    return m
  }, [data])

  const cells = monthGrid(view)
  const monthPrefix = cells.find((c) => c.inMonth)!.iso.slice(0, 7)
  const monthHolidays = (data?.holidays ?? []).filter((h) => h.date.startsWith(monthPrefix))
  const yearCounts = {
    national: data?.holidays.filter((h) => h.type === 'national').length ?? 0,
    collective_leave: data?.holidays.filter((h) => h.type === 'collective_leave').length ?? 0,
  }
  const selectedHolidays = byDate.get(selected) ?? []

  /** Shows another month, selecting today if it's in that month, else the 1st. */
  function go(next: YearMonth) {
    setView(next)
    const first = isoDate(next.year, next.month, 1)
    setSelected(today.slice(0, 7) === first.slice(0, 7) ? today : first)
  }

  function goToday() {
    const d = new Date()
    go({ year: d.getFullYear(), month: d.getMonth() })
  }

  function select(iso: string) {
    setSelected(iso)
    const [y, m] = iso.split('-').map(Number)
    if (y !== view.year || m - 1 !== view.month) setView({ year: y, month: m - 1 })
  }

  return (
    <div className="calendar-tool">
      <section className="card calendar-card" aria-labelledby="calendar-title">
        <div className="calendar-head">
          <button
            type="button"
            className="btn btn-secondary icon-btn"
            aria-label="Previous month"
            onClick={() => go(addMonths(view, -1))}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <h2 id="calendar-title" className="calendar-title" aria-live="polite">
            {formatMonth(view)}
          </h2>
          <button
            type="button"
            className="btn btn-secondary icon-btn"
            aria-label="Next month"
            onClick={() => go(addMonths(view, 1))}
          >
            <Icon name="chevronRight" size={18} />
          </button>
          <button type="button" className="btn btn-secondary today-btn" onClick={goToday}>
            Today
          </button>
        </div>

        <div className="calendar-grid" role="grid" aria-labelledby="calendar-title">
          <div className="calendar-row" role="row">
            {WEEKDAYS.map((d, i) => (
              <span key={d} role="columnheader" className="weekday" data-sunday={i === 0 || undefined}>
                {d}
              </span>
            ))}
          </div>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <div className="calendar-row" role="row" key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((c) => {
                const days = c.inMonth ? (byDate.get(c.iso) ?? []) : []
                const national = days.some((h) => h.type === 'national')
                const leave = !national && days.length > 0
                const label = [
                  formatLongDate(c.iso),
                  c.iso === today ? 'today' : '',
                  ...days.map((h) => `${h.name} (${TYPE_LABEL[h.type]})`),
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  <div role="gridcell" key={c.iso} aria-selected={c.iso === selected}>
                    <button
                      type="button"
                      className="day"
                      aria-label={label}
                      aria-pressed={c.iso === selected}
                      data-outside={!c.inMonth || undefined}
                      data-sunday={c.weekday === 0 || undefined}
                      data-national={national || undefined}
                      data-leave={leave || undefined}
                      data-today={c.iso === today || undefined}
                      onClick={() => select(c.iso)}
                    >
                      <span className="day-num">{c.day}</span>
                      {days.length > 0 && <span className="day-name">{days[0].name}</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <ul className="legend" aria-label="Legend">
          <li>
            <span className="swatch swatch-national" /> Public holiday
          </li>
          <li>
            <span className="swatch swatch-leave" /> Cuti bersama
          </li>
          <li>
            <span className="swatch swatch-today" /> Today
          </li>
        </ul>
      </section>

      <section className="card day-card" aria-labelledby="day-title" aria-live="polite">
        <h2 id="day-title" className="section-title">
          {formatLongDate(selected)}
        </h2>
        {selectedHolidays.length > 0 ? (
          <ul className="holiday-list">
            {selectedHolidays.map((h) => (
              <li key={h.type} className="holiday" data-type={h.type}>
                <strong>{h.name}</strong>
                <span className="badge">{TYPE_LABEL[h.type]}</span>
              </li>
            ))}
          </ul>
        ) : hasData ? (
          <p className="muted">{selected === today ? 'Today is' : 'This is'} a regular day, not a holiday.</p>
        ) : null}
      </section>

      <section className="month-section" aria-labelledby="month-list-title">
        <h2 id="month-list-title" className="section-title">
          Holidays in {formatMonth(view)}
        </h2>

        {state.status === 'loading' && (
          <p className="muted" role="status">
            Looking up the holidays…
          </p>
        )}

        {state.status === 'error' && (
          <div className="error" role="alert">
            <p>{state.message}</p>
            <button type="button" className="btn btn-secondary retry-btn" onClick={retry}>
              <Icon name="reset" size={16} />
              Try again
            </button>
          </div>
        )}

        {data && !hasData && (
          <p className="empty">
            No holiday data for {view.year} yet. Holidays are set each year by the government; this calendar
            has {yearRange(data.availableYears)}.
          </p>
        )}

        {hasData && monthHolidays.length === 0 && <p className="empty">No holidays this month.</p>}

        {hasData && monthHolidays.length > 0 && (
          <ul className="holiday-list">
            {monthHolidays.map((h) => (
              <li key={`${h.date}-${h.type}`}>
                <button
                  type="button"
                  className="holiday holiday-btn"
                  data-type={h.type}
                  aria-pressed={h.date === selected}
                  onClick={() => select(h.date)}
                >
                  <span className="holiday-date">{formatShortDate(h.date)}</span>
                  <strong>{h.name}</strong>
                  <span className="badge">{TYPE_LABEL[h.type]}</span>
                  <span className="holiday-when">{relativeDays(daysBetween(today, h.date))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasData && (
          <p className="hint">
            {view.year}: {yearCounts.national} public holidays and {yearCounts.collective_leave} cuti bersama days,
            per the SKB 3 Menteri. Islamic holiday dates can still shift with the government's official sighting.
          </p>
        )}
      </section>
    </div>
  )
}
