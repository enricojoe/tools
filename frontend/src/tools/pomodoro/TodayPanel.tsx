import { Icon } from '../../components/Icon'
import type { PomodoroDay } from '../../api/pomodoro'
import { PHASE_LABEL } from './phases'

interface TodayPanelProps {
  day: PomodoroDay | null
  /** Why today's sessions couldn't be loaded, or null. */
  error: string | null
  /** Finished phases that haven't reached the server yet. */
  unsaved: number
  onRetry: () => void
}

/** "1h 25m", "25m" or "45s": a length of time in plain words. */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TodayPanel({ day, error, unsaved, onRetry }: TodayPanelProps) {
  return (
    <section className="card today-card" aria-labelledby="today-title">
      <h2 id="today-title" className="section-title">
        Today
      </h2>

      {(error !== null || unsaved > 0) && (
        <div className="error" role="alert">
          <p>
            {unsaved > 0
              ? `Couldn't save ${unsaved === 1 ? 'a session' : `${unsaved} sessions`} to the server yet. The timer is fine, so keep going!`
              : "Couldn't load today's sessions, but the timer works just fine."}
          </p>
          <button type="button" className="btn btn-secondary retry-btn" onClick={onRetry}>
            <Icon name="reset" size={16} />
            Try again
          </button>
        </div>
      )}

      {day === null && error === null && (
        <p className="muted" role="status">
          Looking up today's sessions…
        </p>
      )}

      {day !== null && (
        <>
          <dl className="today-stats">
            <div>
              <dt>Focus sessions</dt>
              <dd>{day.focusCount}</dd>
            </div>
            <div>
              <dt>Time focused</dt>
              <dd>{formatDuration(day.focusSeconds)}</dd>
            </div>
          </dl>

          {day.sessions.length === 0 ? (
            <p className="empty">Nothing yet. Finish a focus round and it shows up here.</p>
          ) : (
            <ul className="session-list">
              {day.sessions.map((s) => (
                <li key={s.id} className="session" data-kind={s.kind}>
                  <span className="badge">{PHASE_LABEL[s.kind]}</span>
                  <span className="session-label">{s.label || (s.kind === 'focus' ? 'Focus' : 'Break')}</span>
                  <span className="session-when">
                    {formatDuration(s.durationSeconds)} · {formatClock(s.completedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
