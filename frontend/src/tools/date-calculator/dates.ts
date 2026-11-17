/**
 * Date math for the date calculator. A date is a whole "day number": days
 * since 1970-01-01 on the calendar, with no time of day or timezone, so
 * adding and subtracting is plain integer math and daylight saving can't
 * shift a day.
 */

const DAY_MS = 86_400_000

export interface Ymd {
  y: number
  /** 0-based, like `Date`. */
  m: number
  d: number
}

/** Day number of a calendar date; `m` and `d` may overflow (Date normalizes them). */
export function toDay(y: number, m: number, d: number): number {
  // setUTCFullYear, unlike Date.UTC, doesn't turn years 0–99 into 1900–1999.
  const t = new Date(0)
  t.setUTCFullYear(y, m, d)
  return Math.round(t.getTime() / DAY_MS)
}

export function fromDay(day: number): Ymd {
  const t = new Date(day * DAY_MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }
}

export const MIN_DAY = toDay(1, 0, 1)
export const MAX_DAY = toDay(9999, 11, 31)

export function inRange(day: number): boolean {
  return day >= MIN_DAY && day <= MAX_DAY
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** "YYYY-MM-DD", the format of `<input type="date">` and the holidays API. */
export function toIso(day: number): string {
  const { y, m, d } = fromDay(day)
  return `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`
}

/** Parses "YYYY-MM-DD" (years 1–9999); null when it isn't a real date. */
export function parseIso(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [y, m, d] = match.slice(1).map(Number)
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m - 1)) return null
  return toDay(y, m - 1, d)
}

/** Today on this device's clock. */
export function today(): number {
  const now = new Date()
  return toDay(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysInMonth(y: number, m: number): number {
  return fromDay(toDay(y, m + 1, 0)).d
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** 0 = Sunday … 6 = Saturday. Day 0 (1970-01-01) was a Thursday. */
export function weekday(day: number): number {
  return (((day + 4) % 7) + 7) % 7
}

export function isWeekend(day: number): boolean {
  const w = weekday(day)
  return w === 0 || w === 6
}

// ---------------------------------------------------------------------------
// Adding and subtracting

export interface Amounts {
  years: number
  months: number
  weeks: number
  days: number
}

export interface AddResult {
  day: number
  /** Set when the start day doesn't exist in the target month (31 Jan + 1 month). */
  clamped: { from: number; to: number } | null
}

/** Moves `start` by whole months, keeping the day of the month or clamping it to the month's last day. */
function shiftMonths(start: number, months: number): { day: number; clampedFrom: number | null } {
  const { y, m, d } = fromDay(start)
  const index = y * 12 + m + months
  const ny = Math.floor(index / 12)
  const nm = index - ny * 12
  const nd = Math.min(d, daysInMonth(ny, nm))
  return { day: toDay(ny, nm, nd), clampedFrom: nd === d ? null : d }
}

/**
 * `start` plus (sign 1) or minus (sign -1) the amounts. Years and months go
 * first, on the calendar; then weeks and days. Null when the answer is
 * outside years 1–9999.
 */
export function addAmounts(start: number, amounts: Amounts, sign: 1 | -1): AddResult | null {
  const { years, months, weeks, days } = amounts
  const shifted = shiftMonths(start, sign * (years * 12 + months))
  const day = shifted.day + sign * (weeks * 7 + days)
  if (!inRange(day)) return null
  const clamped = shifted.clampedFrom === null ? null : { from: shifted.clampedFrom, to: fromDay(shifted.day).d }
  return { day, clamped }
}

/** Largest working-day count accepted, about 40 years. */
export const MAX_WORKING_DAYS = 10_000

/**
 * Steps `count` working days from `start` (which itself doesn't count),
 * passing over the days `isOff` says are off. Null when out of range.
 */
export function addWorkingDays(
  start: number,
  count: number,
  sign: 1 | -1,
  isOff: (day: number) => boolean,
): { day: number; skipped: number } | null {
  let day = start
  let left = count
  let skipped = 0
  while (left > 0) {
    day += sign
    if (!inRange(day)) return null
    if (isOff(day)) skipped++
    else left--
  }
  return { day, skipped }
}

// ---------------------------------------------------------------------------
// Between two dates

export interface Difference {
  /** -1 when the end is before the start. */
  sign: 1 | -1
  totalDays: number
  /** Whole months, then the days left over (calendar months, clamped like adding). */
  totalMonths: number
  years: number
  months: number
  days: number
}

/** The gap from `lo` to `hi` (`hi` ≥ `lo`), in calendar terms. */
function gap(lo: number, hi: number): Omit<Difference, 'sign'> {
  const a = fromDay(lo)
  const b = fromDay(hi)
  let totalMonths = (b.y - a.y) * 12 + (b.m - a.m)
  let anchor = shiftMonths(lo, totalMonths).day
  if (anchor > hi) {
    totalMonths--
    anchor = shiftMonths(lo, totalMonths).day
  }
  return {
    totalDays: hi - lo,
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: hi - anchor,
  }
}

/**
 * From `from` to `to`. With `includeEnd`, the last day counts too, so the
 * same date twice is 1 day.
 */
export function difference(from: number, to: number, includeEnd: boolean): Difference {
  const sign = to >= from ? 1 : -1
  const lo = Math.min(from, to)
  const hi = Math.max(from, to) + (includeEnd ? 1 : 0)
  return { sign, ...gap(lo, hi) }
}

/** Monday–Friday days in [lo, hiExclusive). */
export function countWeekdays(lo: number, hiExclusive: number): number {
  const span = hiExclusive - lo
  if (span <= 0) return 0
  let count = Math.floor(span / 7) * 5
  for (let day = lo + Math.floor(span / 7) * 7; day < hiExclusive; day++) {
    if (!isWeekend(day)) count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Facts about a date

export interface DateFacts {
  weekday: number
  /** ISO 8601 week (weeks start on Monday; week 1 holds the year's first Thursday). */
  isoWeek: number
  isoWeekYear: number
  dayOfYear: number
  daysInYear: number
  quarter: number
}

export function dateFacts(day: number): DateFacts {
  const { y, m } = fromDay(day)
  const mondayBased = (weekday(day) + 6) % 7
  const thursday = day - mondayBased + 3
  const isoWeekYear = fromDay(thursday).y
  return {
    weekday: weekday(day),
    isoWeek: Math.floor((thursday - toDay(isoWeekYear, 0, 1)) / 7) + 1,
    isoWeekYear,
    dayOfYear: day - toDay(y, 0, 1) + 1,
    daysInYear: isLeapYear(y) ? 366 : 365,
    quarter: Math.floor(m / 3) + 1,
  }
}

function utcFormat(options: Intl.DateTimeFormatOptions): (day: number) => string {
  const format = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })
  return (day) => format.format(new Date(day * DAY_MS))
}

/** "Thursday, 26 November 2026" */
export const formatLong = utcFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
/** "Thu 26 Nov 2026" */
export const formatShort = utcFormat({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const formatWeekday = utcFormat({ weekday: 'long' })
export const formatMonth = utcFormat({ month: 'long' })

export function plural(n: number, word: string): string {
  return `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`
}

const countFormat = new Intl.NumberFormat('en-US')

export function formatCount(n: number): string {
  return countFormat.format(n)
}

/** "today", "tomorrow", "in 10 days", "3 days ago" — `diff` is target minus today. */
export function relativeDays(diff: number): string {
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return diff > 0 ? `in ${plural(diff, 'day')}` : `${plural(-diff, 'day')} ago`
}

// ---------------------------------------------------------------------------
// Converting durations

export type DurationUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'decade'

export const DURATION_UNITS: { id: DurationUnit; label: string; short: string }[] = [
  { id: 'second', label: 'Seconds', short: 'sec' },
  { id: 'minute', label: 'Minutes', short: 'min' },
  { id: 'hour', label: 'Hours', short: 'hr' },
  { id: 'day', label: 'Days', short: 'day' },
  { id: 'week', label: 'Weeks', short: 'wk' },
  { id: 'month', label: 'Months', short: 'mo' },
  { id: 'year', label: 'Years', short: 'yr' },
  { id: 'decade', label: 'Decades', short: 'dec' },
]

export type YearBasis = 'common' | 'average' | 'leap'

export const YEAR_BASES: { id: YearBasis; days: number; label: string; hint: string }[] = [
  { id: 'common', days: 365, label: '365', hint: 'A common year.' },
  {
    id: 'average',
    days: 365.2425,
    label: '365.2425',
    hint: 'The average year on the Gregorian calendar, counting leap years (97 every 400 years).',
  },
  { id: 'leap', days: 366, label: '366', hint: 'A leap year, like 2028.' },
]

/** Seconds in one `unit`. A month is a twelfth of a year. */
export function unitSeconds(unit: DurationUnit, yearDays: number): number {
  const day = 86_400
  switch (unit) {
    case 'second':
      return 1
    case 'minute':
      return 60
    case 'hour':
      return 3_600
    case 'day':
      return day
    case 'week':
      return 7 * day
    case 'month':
      return (yearDays / 12) * day
    case 'year':
      return yearDays * day
    case 'decade':
      return 10 * yearDays * day
  }
}

export function convertDuration(value: number, unit: DurationUnit, yearDays: number): Record<DurationUnit, number> {
  const seconds = value * unitSeconds(unit, yearDays)
  return Object.fromEntries(
    DURATION_UNITS.map((u) => [u.id, seconds / unitSeconds(u.id, yearDays)]),
  ) as Record<DurationUnit, number>
}

const BREAKDOWN_UNITS: DurationUnit[] = ['year', 'week', 'day', 'hour', 'minute', 'second']

export type Breakdown = { unit: DurationUnit; count: number }[]

/**
 * The duration as years, weeks, days, hours, minutes and seconds, e.g.
 * 1000 days → "2 years, 38 weeks, 4 days". When that just repeats the input
 * (1 year → "1 year"), it starts one unit smaller: "52 weeks, 1 day". Months
 * are left out: they don't hold a whole number of days. Empty for zero, null
 * when too large to break down.
 */
export function breakdown(value: number, unit: DurationUnit, yearDays: number): Breakdown | null {
  // Whole milliseconds, so 0.1 + 0.2 style float noise doesn't leave "0.0000001 sec".
  const ms = Math.round(Math.abs(value) * unitSeconds(unit, yearDays) * 1000)
  if (!Number.isSafeInteger(ms)) return null
  const parts = splitMs(ms, BREAKDOWN_UNITS, yearDays)
  if (parts.length === 1 && parts[0].unit === unit && unit !== 'second') {
    return splitMs(ms, BREAKDOWN_UNITS.slice(BREAKDOWN_UNITS.indexOf(unit) + 1), yearDays)
  }
  return parts
}

function splitMs(total: number, units: DurationUnit[], yearDays: number): Breakdown {
  let ms = total
  const parts: Breakdown = []
  for (const u of units) {
    const size = Math.round(unitSeconds(u, yearDays) * 1000)
    const count = u === 'second' ? ms / size : Math.floor(ms / size)
    ms -= Math.floor(count) * size
    if (count > 0) parts.push({ unit: u, count })
  }
  return parts
}

/** Parses a duration amount: digits with an optional decimal point (or comma), up to 1e12. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n <= 1e12 ? n : null
}

/** Parses a whole count (blank is 0), up to `max`. */
export function parseWhole(text: string, max: number): number | null {
  const t = text.trim()
  if (t === '') return 0
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n <= max ? n : null
}

const smallFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const mainFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })

/** Readable number: grouped, up to 4 decimals, small values to 4 significant digits. */
export function formatAmount(n: number): string {
  if (n !== 0 && Math.abs(n) < 0.001) return smallFormat.format(n)
  return mainFormat.format(n)
}
