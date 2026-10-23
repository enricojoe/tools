import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import {
  createStopwatchSession,
  deleteStopwatchSession,
  fetchStopwatchSessions,
  type NewStopwatchSession,
  type StopwatchSession,
} from '../../api/stopwatch'

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.')

/** Recent saved runs from the API. The stopwatch itself never waits on this. */
export function useSavedRuns() {
  const [runs, setRuns] = useState<StopwatchSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchStopwatchSessions(50, ctrl.signal)
      .then((data) => {
        setRuns(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setError(errorText(err))
      })
    return () => ctrl.abort()
  }, [attempt])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  /** Saves a run and refreshes the list. Resolves to an error message, or null on success. */
  const save = useCallback(async (input: NewStopwatchSession): Promise<string | null> => {
    try {
      await createStopwatchSession(input)
      setAttempt((a) => a + 1)
      return null
    } catch (err) {
      return errorText(err)
    }
  }, [])

  /** Deletes a run. Resolves to an error message, or null on success. */
  const remove = useCallback(async (id: string): Promise<string | null> => {
    try {
      await deleteStopwatchSession(id)
    } catch (err) {
      // Already gone on the server: just drop it from the list.
      if (!(err instanceof ApiError && err.status === 404)) return errorText(err)
    }
    setRuns((prev) => prev?.filter((r) => r.id !== id) ?? prev)
    return null
  }, [])

  return { runs, error, retry, save, remove }
}
