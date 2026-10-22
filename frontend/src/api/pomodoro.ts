import { toApiError } from './client'

export type SessionKind = 'focus' | 'short_break' | 'long_break'

/** A finished Pomodoro phase as stored by the server. */
export interface PomodoroSession {
  id: string
  kind: SessionKind
  durationSeconds: number
  /** Empty when the session had no label. */
  label: string
  /** RFC3339 timestamp. */
  completedAt: string
}

/** Body of `POST /api/pomodoro/sessions`. */
export interface NewSession {
  kind: SessionKind
  /** 1–14400. */
  durationSeconds: number
  /** Up to 100 characters. */
  label?: string
  /** RFC3339; the server uses "now" when omitted. */
  completedAt?: string
}

/** Raw `GET /api/pomodoro/sessions` response. */
export interface PomodoroDay {
  /** Calendar day as YYYY-MM-DD (server timezone). */
  date: string
  sessions: PomodoroSession[]
  focusCount: number
  focusSeconds: number
}

function isKind(v: unknown): v is SessionKind {
  return v === 'focus' || v === 'short_break' || v === 'long_break'
}

function isSession(s: unknown): s is PomodoroSession {
  if (typeof s !== 'object' || s === null) return false
  const v = s as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    isKind(v.kind) &&
    typeof v.durationSeconds === 'number' &&
    typeof v.label === 'string' &&
    typeof v.completedAt === 'string'
  )
}

function isDay(body: unknown): body is PomodoroDay {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.date === 'string' &&
    Array.isArray(b.sessions) &&
    b.sessions.every(isSession) &&
    typeof b.focusCount === 'number' &&
    typeof b.focusSeconds === 'number'
  )
}

/** Records a finished phase. Throws an ApiError on failure. */
export async function createSession(input: NewSession): Promise<PomodoroSession> {
  const res = await fetch('/api/pomodoro/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isSession(body)) throw new Error('The server sent an unexpected session response.')
  return body
}

/** Fetches one day's sessions (today in the server's timezone when `date` is omitted). */
export async function fetchSessions(date?: string, signal?: AbortSignal): Promise<PomodoroDay> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  const res = await fetch(`/api/pomodoro/sessions${query}`, { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isDay(body)) throw new Error('The server sent an unexpected sessions response.')
  return body
}
