import { Icon } from '../../components/Icon'
import { RingDialog } from '../shared/RingDialog'
import { NotifyPrompt } from '../shared/NotifyPrompt'
import { unlockAudio } from '../shared/alert'
import { useAlertSound, useNotifyPermission } from '../shared/useAlert'
import { useServerClock } from '../shared/useServerClock'
import { formatClock, formatDate, formatUtcOffset } from './alarmTime'
import { AlarmForm } from './AlarmForm'
import { AlarmList } from './AlarmList'
import { useAlarms } from './useAlarms'
import '../shared/shared.css'
import './AlarmTool.css'

export default function AlarmTool() {
  const clock = useServerClock()
  const offset = clock.sync?.utcOffsetSeconds ?? 0
  const { alarms, ringing, add, toggle, remove, dismiss, dismissAll, snooze } = useAlarms({
    now: clock.now,
    serverNow: clock.serverNow,
    utcOffsetSeconds: offset,
  })
  const { permission, request } = useNotifyPermission()
  useAlertSound(ringing.length > 0)

  const { now, sync } = clock
  const ready = now !== null && sync !== null

  return (
    <div className="time-tool">
      <section className="card clock-card" aria-label="Server clock">
        {ready ? (
          <>
            <p className="clock-zone">
              Server time · {sync.timezone} ({formatUtcOffset(offset)})
            </p>
            <p className="clock-time" role="timer" aria-live="off">
              {formatClock(now, offset)}
            </p>
            <p className="clock-date">{formatDate(now, offset)}</p>
          </>
        ) : clock.loading ? (
          <p className="clock-status" role="status">
            Checking the server's clock…
          </p>
        ) : null}

        {clock.error && (
          <div className="error" role="alert">
            <p>
              {ready
                ? `${clock.error} Using the last sync for now.`
                : `${clock.error} Alarms follow the server's clock, so they can't ring until it's back.`}
            </p>
            <button type="button" className="btn btn-secondary retry-btn" onClick={clock.retry}>
              <Icon name="reset" size={16} />
              Try again
            </button>
          </div>
        )}
      </section>

      {ready && (
        <>
          <NotifyPrompt permission={permission} onRequest={() => void request()} />
          <AlarmForm onAdd={add} />
          <section aria-labelledby="alarm-list-title" className="alarm-section">
            <h2 id="alarm-list-title" className="section-title">
              Your alarms
            </h2>
            <AlarmList
              alarms={alarms}
              now={now}
              utcOffsetSeconds={offset}
              onToggle={(id) => {
                unlockAudio()
                toggle(id)
              }}
              onRemove={remove}
            />
          </section>
          <p className="hint">
            Alarms only ring while this page is open (a background tab is fine). They're saved in this browser.
          </p>
        </>
      )}

      {ringing.length > 0 && (
        <RingDialog title="Alarm!" onEscape={dismissAll}>
          <ul className="ring-list">
            {ringing.map((r, i) => (
              <li key={r.id} className="ring-item">
                <p className="ring-what" role="status">
                  <strong>{r.label || 'Alarm'}</strong> · {r.time}
                </p>
                <div className="ring-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => snooze(r.id)}>
                    <Icon name="moon" size={18} />
                    Snooze 5 min
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-autofocus={i === 0 ? '' : undefined}
                    onClick={() => dismiss(r.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </RingDialog>
      )}
    </div>
  )
}
