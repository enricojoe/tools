import { useEffect, useState } from 'react'
import {
  convertUnit,
  fetchUnitCategories,
  type Conversion,
  type UnitCategory,
} from '../../api/units'

const DEBOUNCE_MS = 250

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

/** Loads the unit catalogue once. Bump `attempt` to retry after a failure. */
export function useUnitCategories(attempt: number) {
  const [categories, setCategories] = useState<UnitCategory[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchUnitCategories(ctrl.signal)
      .then((data) => {
        setCategories(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        setError(messageOf(err))
      })
    return () => ctrl.abort()
  }, [attempt])

  return { categories, error }
}

/**
 * Converts `value` (already validated, or null to skip) once it stops changing.
 * Stale requests are aborted; the last good answer stays until a new one arrives.
 * Bump `attempt` to retry after a failure.
 */
export function useConversion(
  category: string,
  from: string,
  value: string | null,
  attempt: number,
) {
  const [conversion, setConversion] = useState<Conversion | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (value === null || from === '') return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      convertUnit(category, from, value, ctrl.signal)
        .then((data) => {
          setConversion(data)
          setError(null)
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return
          setError(messageOf(err))
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [category, from, value, attempt])

  return { conversion, error }
}
