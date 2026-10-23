import { toApiError } from './client'

/** A saved stopwatch run as stored by the server. */
export interface StopwatchSession {
  id: string
  /** Empty when the run had no label. */
  label: string
  elapsedMs: number
  /** Lap durations in ms, in the order they were taken. */
  laps: number[]
  /** RFC3339 timestamp. */
  completedAt: string
}

/** Body of `POST /api/stopwatch/sessions`. */
export interface NewStopwatchSession {
  /** Up to 100 characters. */
  label?: string
  /** Integer, 1–86400000. */
  elapsedMs: number
  /** Up to 1000 integer durations ≥ 1 whose sum is at most `elapsedMs`. */
  laps?: number[]
  /** RFC3339; the server uses "now" when omitted. */
  completedAt?: string
}

function isSession(s: unknown): s is StopwatchSession {
  if (typeof s !== 'object' || s === null) return false
  const v = s as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.elapsedMs === 'number' &&
    Array.isArray(v.laps) &&
    v.laps.every((l) => typeof l === 'number') &&
    typeof v.completedAt === 'string'
  )
}

/** Saves a run. Throws an ApiError on failure. */
export async function createStopwatchSession(input: NewStopwatchSession): Promise<StopwatchSession> {
  const res = await fetch('/api/stopwatch/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isSession(body)) throw new Error('The server sent an unexpected session response.')
  return body
}

/** Fetches the most recent runs, newest first. */
export async function fetchStopwatchSessions(limit = 50, signal?: AbortSignal): Promise<StopwatchSession[]> {
  const res = await fetch(`/api/stopwatch/sessions?limit=${limit}`, { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('sessions' in body) ||
    !Array.isArray(body.sessions) ||
    !body.sessions.every(isSession)
  ) {
    throw new Error('The server sent an unexpected sessions response.')
  }
  return body.sessions
}

/** Deletes a saved run. Throws an ApiError on failure (404 when it is already gone). */
export async function deleteStopwatchSession(id: string): Promise<void> {
  const res = await fetch(`/api/stopwatch/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw await toApiError(res)
}
