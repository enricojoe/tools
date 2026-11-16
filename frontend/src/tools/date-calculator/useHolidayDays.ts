import { useEffect, useState } from 'react'
import { fetchHolidays, type Holiday, type HolidayYear } from '../../api/holidays'
import { parseIso } from './dates'

export type HolidayLookup =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  /**
   * `byDay` maps a day number to its holiday; `available` lists the years the
   * server has data for, and `partial` says some asked-for years aren't among them.
   */
  | { status: 'ready'; byDay: ReadonlyMap<number, Holiday>; available: number[]; partial: boolean }

/** Years are fetched once per page load and shared by every mode. */
const cache = new Map<number, Promise<HolidayYear>>()

function loadYear(year: number): Promise<HolidayYear> {
  let pending = cache.get(year)
  if (!pending) {
    pending = fetchHolidays(year)
    pending.catch(() => cache.delete(year))
    cache.set(year, pending)
  }
  return pending
}

/** Most years looked up at once; beyond that only weekends are skipped. */
const MAX_YEARS = 60

/**
 * Indonesian public holidays and cuti bersama for the years `first`–`last`
 * (in either order). The first year's answer says which years have data, so
 * years without any are never fetched. `enabled: false` skips the lookup.
 */
export function useHolidayDays(first: number, last: number, enabled: boolean, attempt: number): HolidayLookup {
  // The API takes years 1–9999.
  const lo = Math.max(1, Math.min(first, last, 9999))
  const hi = Math.min(Math.max(first, last), lo + MAX_YEARS - 1, 9999)
  // The attempt is part of the key, so a retry shows "loading" until it settles.
  const key = `${lo}-${hi}#${attempt}`
  const [result, setResult] = useState<{ key: string; lookup: HolidayLookup } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    async function run() {
      const head = await loadYear(lo)
      const available = new Set(head.availableYears)
      const years = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
      const rest = await Promise.all(years.slice(1).filter((y) => available.has(y)).map(loadYear))
      const byDay = new Map<number, Holiday>()
      for (const h of [head, ...rest].flatMap((y) => y.holidays)) {
        const day = parseIso(h.date)
        if (day !== null) byDay.set(day, h)
      }
      const partial = Math.max(first, last) > hi || years.some((y) => !available.has(y))
      return { byDay, available: head.availableYears, partial }
    }
    run()
      .then((ready) => !cancelled && setResult({ key, lookup: { status: 'ready', ...ready } }))
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Something went wrong.'
        setResult({ key, lookup: { status: 'error', message } })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, key, lo, hi, first, last])

  if (!enabled) return { status: 'off' }
  if (result === null || result.key !== key) return { status: 'loading' }
  return result.lookup
}

export function holidayKind(h: Holiday): string {
  return h.type === 'national' ? 'Public holiday' : 'Cuti bersama'
}
