import { useCallback, useEffect, useState } from 'react'
import { fetchHolidays, type HolidayYear } from '../../api/holidays'

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: HolidayYear }
  | { status: 'error'; message: string }

/**
 * Loads one year of holidays. Years already fetched are kept for the life of
 * the page, so flipping back and forth between months doesn't refetch.
 */
export function useHolidays(year: number) {
  const [cache, setCache] = useState<ReadonlyMap<number, HolidayYear>>(new Map())
  const [errors, setErrors] = useState<ReadonlyMap<number, string>>(new Map())
  const [attempt, setAttempt] = useState(0)

  const cached = cache.get(year)
  useEffect(() => {
    if (cached) return
    const ctrl = new AbortController()
    fetchHolidays(year, ctrl.signal)
      .then((data) => {
        setCache((m) => new Map(m).set(year, data))
        setErrors((m) => {
          const next = new Map(m)
          next.delete(year)
          return next
        })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Something went wrong.'
        setErrors((m) => new Map(m).set(year, `Couldn't load the holidays: ${message}`))
      })
    return () => ctrl.abort()
  }, [year, cached, attempt])

  const retry = useCallback(() => {
    setErrors((m) => {
      const next = new Map(m)
      next.delete(year)
      return next
    })
    setAttempt((a) => a + 1)
  }, [year])

  const error = errors.get(year)
  const state: State = cached
    ? { status: 'ready', data: cached }
    : error
      ? { status: 'error', message: error }
      : { status: 'loading' }
  return { state, retry }
}
