import { toApiError } from './client'

/** Raw `GET /api/time` response. */
export interface ServerTime {
  unixMs: number
  iso: string
  /** IANA name of the server's timezone, e.g. "Asia/Jakarta". */
  timezone: string
  /** Offset of the server's timezone from UTC, in seconds (east is positive). */
  utcOffsetSeconds: number
}

/** The server clock relative to this device's clock. */
export interface ClockSync {
  /** Add to `Date.now()` to get the server's time, in ms. */
  offsetMs: number
  /** Round-trip time of the measuring request, in ms. */
  rttMs: number
  timezone: string
  utcOffsetSeconds: number
}

function isServerTime(body: unknown): body is ServerTime {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.unixMs === 'number' &&
    Number.isFinite(b.unixMs) &&
    typeof b.iso === 'string' &&
    typeof b.timezone === 'string' &&
    typeof b.utcOffsetSeconds === 'number' &&
    Number.isFinite(b.utcOffsetSeconds)
  )
}

/** Fetches the server's current time. Throws an ApiError on failure. */
export async function fetchServerTime(signal?: AbortSignal): Promise<ServerTime> {
  const res = await fetch('/api/time', { cache: 'no-store', signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isServerTime(body)) throw new Error('The server sent an unexpected time response.')
  return body
}

/**
 * Measures how far this device's clock is from the server's. Assumes the
 * server stamped its time halfway through the round trip.
 */
export async function syncServerClock(signal?: AbortSignal): Promise<ClockSync> {
  const started = performance.now()
  const time = await fetchServerTime(signal)
  const rttMs = performance.now() - started

  return {
    offsetMs: time.unixMs + rttMs / 2 - Date.now(),
    rttMs,
    timezone: time.timezone,
    utcOffsetSeconds: time.utcOffsetSeconds,
  }
}
