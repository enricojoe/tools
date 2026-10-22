import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { syncServerClock, type ClockSync } from '../../api/time'

const RESYNC_MS = 60_000
const TICK_MS = 250

export interface ServerClock {
  /** True until the first sync finishes (successfully or not). */
  loading: boolean
  /** Friendly message when the latest sync failed; `sync` may still hold an older result. */
  error: string | null
  /** Latest successful sync, or null if there has not been one. */
  sync: ClockSync | null
  /** Server time in ms, rounded down to the second; ticks while synced. Null before the first sync. */
  now: number | null
  /** Exact server time in ms right now, or null before the first sync. */
  serverNow: () => number | null
  retry: () => void
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return "Couldn't reach the server to read its clock."
}

/**
 * Keeps this device's clock aligned with the server's: syncs on mount, every
 * minute and whenever the tab becomes visible again. Never falls back to
 * browser time; callers see `error` and no `now` if the first sync fails.
 */
export function useServerClock(): ServerClock {
  const [sync, setSync] = useState<ClockSync | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<number | null>(null)
  const offsetRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const serverNow = useCallback(
    () => (offsetRef.current === null ? null : Date.now() + offsetRef.current),
    [],
  )

  const resync = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller
    syncServerClock(signal)
      .then((result) => {
        if (signal.aborted) return
        offsetRef.current = result.offsetMs
        setSync(result)
        setError(null)
        setNow(Math.floor((Date.now() + result.offsetMs) / 1000) * 1000)
      })
      .catch((err: unknown) => {
        if (!signal.aborted) setError(describeError(err))
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })
  }, [])

  useEffect(() => {
    resync()
    const id = setInterval(() => resync(), RESYNC_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      abortRef.current?.abort()
    }
  }, [resync])

  const synced = sync !== null
  useEffect(() => {
    if (!synced) return
    const id = setInterval(() => {
      const t = serverNow()
      // Same-second ticks are equal values, so React skips the re-render.
      if (t !== null) setNow(Math.floor(t / 1000) * 1000)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [synced, serverNow])

  const retry = useCallback(() => {
    setLoading(true)
    resync()
  }, [resync])

  return { loading, error, sync, now, serverNow, retry }
}
