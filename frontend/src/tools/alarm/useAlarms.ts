import { useCallback, useEffect, useRef, useState } from 'react'
import { notify } from '../shared/alert'
import { isValidTime, nextOccurrence } from './alarmTime'

const STORAGE_KEY = 'tools.alarms.v1'
const SNOOZE_MS = 5 * 60_000
/** A ring older than this (e.g. the laptop slept through it) is skipped, not sounded. */
const STALE_MS = 10 * 60_000

export interface Alarm {
  id: string
  /** "HH:MM" on the server's wall clock. */
  time: string
  label: string
  /** Weekdays (0 = Sunday); empty means it rings once and switches itself off. */
  days: number[]
  enabled: boolean
  /** Server ms at which a snoozed alarm rings again. */
  snoozeUntil: number | null
}

export interface RingingAlarm {
  id: string
  time: string
  label: string
}

export type NewAlarm = Pick<Alarm, 'time' | 'label' | 'days'>

function parseAlarms(raw: unknown): Alarm[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): Alarm[] => {
    if (typeof item !== 'object' || item === null) return []
    const a = item as Record<string, unknown>
    if (typeof a.id !== 'string' || typeof a.time !== 'string' || !isValidTime(a.time)) return []
    return [
      {
        id: a.id,
        time: a.time,
        label: typeof a.label === 'string' ? a.label : '',
        days: Array.isArray(a.days)
          ? a.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
          : [],
        enabled: a.enabled === true,
        snoozeUntil: typeof a.snoozeUntil === 'number' ? a.snoozeUntil : null,
      },
    ]
  })
}

function loadAlarms(): Alarm[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseAlarms(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface UseAlarmsOptions {
  /** Server time in ms (second precision), or null while it is unknown. Alarms only ring when set. */
  now: number | null
  serverNow: () => number | null
  utcOffsetSeconds: number
}

export function useAlarms({ now, serverNow, utcOffsetSeconds }: UseAlarmsOptions) {
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms)
  const [ringing, setRinging] = useState<RingingAlarm[]>([])
  const lastCheckedRef = useRef<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms))
    } catch {
      // Storage unavailable or full: alarms just won't survive a reload.
    }
  }, [alarms])

  // Ring everything that came due since the previous check. Checking a range
  // (not "now equals the alarm minute") survives throttled or sleeping tabs,
  // and the ranges never overlap, so an alarm cannot ring twice for one minute.
  useEffect(() => {
    if (now === null) return
    const from = lastCheckedRef.current ?? now
    lastCheckedRef.current = Math.max(from, now)
    if (now <= from) return

    const rung: RingingAlarm[] = []
    let changed = false
    const next = alarms.map((alarm) => {
      const snoozeDue =
        alarm.snoozeUntil !== null && alarm.snoozeUntil > from && alarm.snoozeUntil <= now
      const scheduledAt = alarm.enabled
        ? nextOccurrence(alarm, from, utcOffsetSeconds)
        : Infinity
      const scheduledDue = scheduledAt <= now

      if (!snoozeDue && !scheduledDue) return alarm
      changed = true

      const dueAt = snoozeDue ? (alarm.snoozeUntil ?? now) : scheduledAt
      if (now - dueAt <= STALE_MS) {
        rung.push({ id: alarm.id, time: alarm.time, label: alarm.label })
      }
      return {
        ...alarm,
        snoozeUntil: snoozeDue ? null : alarm.snoozeUntil,
        enabled: scheduledDue && alarm.days.length === 0 ? false : alarm.enabled,
      }
    })
    if (!changed) return

    setAlarms(next)
    if (rung.length > 0) {
      setRinging((current) => [...current.filter((c) => !rung.some((r) => r.id === c.id)), ...rung])
      for (const r of rung) {
        notify(r.label || 'Alarm', `It's ${r.time}`, `alarm-${r.id}`)
      }
    }
  }, [now, alarms, utcOffsetSeconds])

  const add = useCallback((input: NewAlarm) => {
    setAlarms((current) => [
      ...current,
      { id: newId(), ...input, enabled: true, snoozeUntil: null },
    ])
  }, [])

  const toggle = useCallback((id: string) => {
    setAlarms((current) =>
      current.map((a) => (a.id === id ? { ...a, enabled: !a.enabled, snoozeUntil: null } : a)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setAlarms((current) => current.filter((a) => a.id !== id))
    setRinging((current) => current.filter((r) => r.id !== id))
  }, [])

  const dismiss = useCallback((id: string) => {
    setRinging((current) => current.filter((r) => r.id !== id))
  }, [])

  const dismissAll = useCallback(() => setRinging([]), [])

  const snooze = useCallback(
    (id: string) => {
      const t = serverNow()
      if (t === null) return
      setAlarms((current) =>
        current.map((a) => (a.id === id ? { ...a, snoozeUntil: t + SNOOZE_MS } : a)),
      )
      setRinging((current) => current.filter((r) => r.id !== id))
    },
    [serverNow],
  )

  return { alarms, ringing, add, toggle, remove, dismiss, dismissAll, snooze }
}
