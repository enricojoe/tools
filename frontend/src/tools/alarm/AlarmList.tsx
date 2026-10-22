import { useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { describeRepeat, formatUntil, nextOccurrence } from './alarmTime'
import type { Alarm } from './useAlarms'

interface AlarmListProps {
  alarms: Alarm[]
  /** Server time in ms. */
  now: number
  utcOffsetSeconds: number
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}

interface Row {
  alarm: Alarm
  /** Server ms of the next ring, or null when switched off. */
  nextAt: number | null
}

export function AlarmList({ alarms, now, utcOffsetSeconds, onToggle, onRemove }: AlarmListProps) {
  const rows = useMemo<Row[]>(() => {
    const withNext = alarms.map((alarm): Row => {
      const scheduled = alarm.enabled ? nextOccurrence(alarm, now, utcOffsetSeconds) : null
      const nextAt =
        alarm.snoozeUntil !== null && (scheduled === null || alarm.snoozeUntil < scheduled)
          ? alarm.snoozeUntil
          : scheduled
      return { alarm, nextAt }
    })
    return withNext.sort((a, b) => {
      if (a.nextAt === null && b.nextAt === null) return a.alarm.time.localeCompare(b.alarm.time)
      if (a.nextAt === null) return 1
      if (b.nextAt === null) return -1
      return a.nextAt - b.nextAt
    })
  }, [alarms, now, utcOffsetSeconds])

  if (rows.length === 0) {
    return (
      <p className="empty">No alarms yet. Add one above and it will show up here.</p>
    )
  }

  return (
    <ul className="alarm-list" aria-label="Your alarms">
      {rows.map(({ alarm, nextAt }) => {
        const name = alarm.label ? `${alarm.time} ${alarm.label}` : alarm.time
        return (
          <li key={alarm.id} className="alarm-item" data-off={nextAt === null}>
            <div className="alarm-main">
              <span className="alarm-time">{alarm.time}</span>
              <span className="alarm-meta">
                {alarm.label && <strong>{alarm.label}</strong>}
                <span>
                  {describeRepeat(alarm.days)}
                  {alarm.snoozeUntil !== null && ' · snoozed'}
                </span>
              </span>
              <span className="alarm-until">
                {nextAt === null ? 'Off' : `rings in ${formatUntil(nextAt - now)}`}
              </span>
            </div>
            <div className="alarm-actions">
              <label className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={alarm.enabled}
                  onChange={() => onToggle(alarm.id)}
                  aria-label={`Alarm ${name}`}
                />
                <span className="switch-track" aria-hidden="true" />
              </label>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete alarm ${name}`}
                onClick={() => onRemove(alarm.id)}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
