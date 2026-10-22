import type { SessionKind } from '../../api/pomodoro'

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** A long break comes after this many focus sessions. */
  longBreakEvery: number
  /** Start the next phase on its own instead of waiting for Start. */
  autoStart: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStart: false,
}

/** Allowed range for each number setting (the API caps a session at 4 hours). */
export const LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 120 },
  longBreakEvery: { min: 1, max: 12 },
} as const

const STORAGE_KEY = 'tools:pomodoro-settings'

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/** Keeps every valid field of a stored value and falls back to the default for the rest. */
function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const v = raw as Record<string, unknown>
  const pick = (key: keyof typeof LIMITS): number => {
    const { min, max } = LIMITS[key]
    return inRange(v[key], min, max) ? v[key] : DEFAULT_SETTINGS[key]
  }
  return {
    focusMinutes: pick('focusMinutes'),
    shortBreakMinutes: pick('shortBreakMinutes'),
    longBreakMinutes: pick('longBreakMinutes'),
    longBreakEvery: pick('longBreakEvery'),
    autoStart: typeof v.autoStart === 'boolean' ? v.autoStart : DEFAULT_SETTINGS.autoStart,
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable or full: settings just won't survive a reload.
  }
}

export function phaseMinutes(kind: SessionKind, s: Settings): number {
  return kind === 'focus' ? s.focusMinutes : kind === 'short_break' ? s.shortBreakMinutes : s.longBreakMinutes
}

export const PHASE_LABEL: Record<SessionKind, string> = {
  focus: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
}

/**
 * The phase after `kind`, given how many focus sessions of the cycle are done
 * (counting the one that just ended). A long break resets the cycle.
 */
export function nextPhase(
  kind: SessionKind,
  focusDone: number,
  longBreakEvery: number,
): { kind: SessionKind; focusDone: number } {
  if (kind === 'focus') {
    const done = focusDone + 1
    return { kind: done >= longBreakEvery ? 'long_break' : 'short_break', focusDone: done }
  }
  return { kind: 'focus', focusDone: kind === 'long_break' ? 0 : focusDone }
}
