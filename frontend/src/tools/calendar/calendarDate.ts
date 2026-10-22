/** A calendar month; `month` is 0-based like `Date`. */
export interface YearMonth {
  year: number
  month: number
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD" for a day, matching the API's date format. `day` may overflow; Date normalizes it. */
export function isoDate(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today on this device's clock. */
export function todayIso(): string {
  const d = new Date()
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/**
 * The days shown for a month: whole weeks starting on Sunday, padded with the
 * neighbouring months' days so every row has seven cells.
 */
export function monthGrid({ year, month }: YearMonth): { iso: string; day: number; inMonth: boolean; weekday: number }[] {
  const first = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Math.ceil((first + daysInMonth) / 7) * 7

  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(year, month, i - first + 1)
    return {
      iso: isoDate(year, month, i - first + 1),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      weekday: i % 7,
    }
  })
}

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const longFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** Parses "YYYY-MM-DD" as a local date (not UTC, which can shift the day). */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "October 2026" */
export function formatMonth({ year, month }: YearMonth): string {
  return monthFormat.format(new Date(year, month, 1))
}

/** "Thursday, 22 October 2026" */
export function formatLongDate(iso: string): string {
  return longFormat.format(parseIso(iso))
}

/** "Thu, 22 Oct" */
export function formatShortDate(iso: string): string {
  return shortFormat.format(parseIso(iso))
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000)
}
