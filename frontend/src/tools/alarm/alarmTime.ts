// Pure time helpers. "Zoned" values are real ms shifted by the server's UTC
// offset, so UTC getters on them read as the server's wall clock.

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

export const WEEKDAYS = [
  { value: 0, short: 'Sun', letter: 'S', long: 'Sunday' },
  { value: 1, short: 'Mon', letter: 'M', long: 'Monday' },
  { value: 2, short: 'Tue', letter: 'T', long: 'Tuesday' },
  { value: 3, short: 'Wed', letter: 'W', long: 'Wednesday' },
  { value: 4, short: 'Thu', letter: 'T', long: 'Thursday' },
  { value: 5, short: 'Fri', letter: 'F', long: 'Friday' },
  { value: 6, short: 'Sat', letter: 'S', long: 'Saturday' },
] as const

export interface Schedule {
  /** "HH:MM" on the server's wall clock. */
  time: string
  /** Weekdays (0 = Sunday); empty means a one-shot alarm. */
  days: number[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

/** Real ms of the next time the schedule hits, strictly after `afterMs`. */
export function nextOccurrence(schedule: Schedule, afterMs: number, offsetSec: number): number {
  const [h, m] = schedule.time.split(':').map(Number)
  const zoned = afterMs + offsetSec * 1000
  const dayStart = Math.floor(zoned / DAY_MS) * DAY_MS
  for (let d = 0; d <= 7; d++) {
    const day = dayStart + d * DAY_MS
    if (schedule.days.length > 0 && !schedule.days.includes(new Date(day).getUTCDay())) continue
    const at = day + (h * 60 + m) * MINUTE_MS
    if (at > zoned) return at - offsetSec * 1000
  }
  // Unreachable: any non-empty weekday set recurs within 7 days.
  return afterMs + DAY_MS
}

export function formatClock(ms: number, offsetSec: number): string {
  const d = new Date(ms + offsetSec * 1000)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function formatDate(ms: number, offsetSec: number): string {
  return DATE_FORMAT.format(new Date(ms + offsetSec * 1000))
}

/** "UTC+07:00" */
export function formatUtcOffset(offsetSec: number): string {
  const sign = offsetSec < 0 ? '-' : '+'
  const abs = Math.abs(offsetSec)
  return `UTC${sign}${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}`
}

/** "2h 5m", "1d 3h", or "less than a minute". */
export function formatUntil(ms: number): string {
  const minutes = Math.ceil(ms / MINUTE_MS)
  if (minutes <= 1) return 'less than a minute'
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function describeRepeat(days: number[]): string {
  if (days.length === 0) return 'Once'
  if (days.length === 7) return 'Every day'
  const set = new Set(days)
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return WEEKDAYS.filter((d) => set.has(d.value))
    .map((d) => d.short)
    .join(', ')
}
