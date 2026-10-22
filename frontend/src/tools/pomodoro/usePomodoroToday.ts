import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, fetchSessions, type NewSession, type PomodoroDay } from '../../api/pomodoro'

/**
 * Today's sessions from the API, plus a way to record a finished phase.
 * The timer never waits on this: a failed save is kept and re-sent on retry.
 */
export function usePomodoroToday() {
  const [day, setDay] = useState<PomodoroDay | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unsaved, setUnsaved] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const pending = useRef<NewSession[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    fetchSessions(undefined, ctrl.signal)
      .then((data) => {
        setDay(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      })
    return () => ctrl.abort()
  }, [attempt])

  /** Saves a finished phase, then refreshes the list. */
  const record = useCallback(async (input: NewSession) => {
    try {
      await createSession(input)
    } catch {
      pending.current.push(input)
      setUnsaved(pending.current.length)
    }
    setAttempt((a) => a + 1)
  }, [])

  /** Re-sends sessions that failed to save, then reloads the list. */
  const retry = useCallback(async () => {
    const queue = pending.current
    pending.current = []
    for (const input of queue) {
      try {
        await createSession(input)
      } catch {
        pending.current.push(input)
      }
    }
    setUnsaved(pending.current.length)
    setAttempt((a) => a + 1)
  }, [])

  return { day, error, unsaved, record, retry }
}
