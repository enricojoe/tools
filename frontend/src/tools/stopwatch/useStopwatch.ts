import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_ELAPSED_MS = 86_400_000
export const MAX_LAPS = 1000

export interface Lap {
  /** 1-based lap number. */
  n: number
  /** Duration of this lap in ms. */
  lapMs: number
  /** Elapsed time when the lap was taken. */
  totalMs: number
}

export type StopwatchStatus = 'idle' | 'running' | 'paused'

/**
 * A stopwatch driven by `performance.now()` timestamps: elapsed time is the accumulated time
 * of past runs plus the time since the current run started, so throttled frames never drift.
 */
export function useStopwatch() {
  const [status, setStatus] = useState<StopwatchStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [laps, setLaps] = useState<Lap[]>([])
  const accumulated = useRef(0)
  const startedAt = useRef(0)
  const lastLapAt = useRef(0)

  const readElapsed = useCallback(
    () => Math.min(MAX_ELAPSED_MS, accumulated.current + (performance.now() - startedAt.current)),
    [],
  )

  useEffect(() => {
    if (status !== 'running') return
    let frame = 0
    const tick = () => {
      const e = readElapsed()
      setElapsedMs(e)
      if (e >= MAX_ELAPSED_MS) {
        accumulated.current = MAX_ELAPSED_MS
        setStatus('paused')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [status, readElapsed])

  const start = useCallback(() => {
    if (accumulated.current >= MAX_ELAPSED_MS) return
    startedAt.current = performance.now()
    setStatus('running')
  }, [])

  const pause = useCallback(() => {
    if (status !== 'running') return
    accumulated.current = readElapsed()
    setElapsedMs(accumulated.current)
    setStatus('paused')
  }, [status, readElapsed])

  const reset = useCallback(() => {
    accumulated.current = 0
    lastLapAt.current = 0
    setElapsedMs(0)
    setLaps([])
    setStatus('idle')
  }, [])

  const lap = useCallback(() => {
    if (status !== 'running') return
    const total = Math.round(readElapsed())
    const lapMs = total - lastLapAt.current
    if (lapMs < 1) return
    lastLapAt.current = total
    setLaps((prev) => (prev.length >= MAX_LAPS ? prev : [...prev, { n: prev.length + 1, lapMs, totalMs: total }]))
  }, [status, readElapsed])

  return { status, elapsedMs, laps, start, pause, reset, lap }
}
