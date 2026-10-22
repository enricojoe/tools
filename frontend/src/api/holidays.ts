import { toApiError } from './client'

/** `national` is a public holiday (hari libur nasional); `collective_leave` is cuti bersama. */
export type HolidayType = 'national' | 'collective_leave'

export interface Holiday {
  /** Calendar day as YYYY-MM-DD. */
  date: string
  /** Official Indonesian name. */
  name: string
  type: HolidayType
}

/** Raw `GET /api/holidays` response. */
export interface HolidayYear {
  year: number
  /** One entry per day, sorted by date. Empty when the year has no data. */
  holidays: Holiday[]
  /** Years the server has data for, ascending. */
  availableYears: number[]
}

function isHoliday(h: unknown): h is Holiday {
  if (typeof h !== 'object' || h === null) return false
  const v = h as Record<string, unknown>
  return (
    typeof v.date === 'string' &&
    typeof v.name === 'string' &&
    (v.type === 'national' || v.type === 'collective_leave')
  )
}

function isHolidayYear(body: unknown): body is HolidayYear {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.year === 'number' &&
    Array.isArray(b.holidays) &&
    b.holidays.every(isHoliday) &&
    Array.isArray(b.availableYears) &&
    b.availableYears.every((y) => typeof y === 'number')
  )
}

/** Fetches Indonesia's holidays for `year`. Throws an ApiError on failure. */
export async function fetchHolidays(year: number, signal?: AbortSignal): Promise<HolidayYear> {
  const res = await fetch(`/api/holidays?year=${year}`, { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isHolidayYear(body)) throw new Error('The server sent an unexpected holidays response.')
  return body
}
