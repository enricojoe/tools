import { useEffect, useState } from 'react'
import { fetchColor, type ColorInfo } from '../../api/colors'

const DEBOUNCE_MS = 200

/**
 * Looks up `hex` ("#RRGGBB") on the server once it stops changing.
 * Stale requests are aborted; the last good result stays visible while a new one loads.
 * Bump `attempt` to retry after a failure.
 */
export function useColorInfo(hex: string, attempt: number) {
  const [info, setInfo] = useState<ColorInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetchColor(hex.slice(1), ctrl.signal)
        .then((data) => {
          setInfo(data)
          setError(null)
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return
          setError(err instanceof Error ? err.message : 'Something went wrong.')
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [hex, attempt])

  return { info, error }
}
