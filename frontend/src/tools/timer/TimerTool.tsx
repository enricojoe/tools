import { useEffect, useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import { NotifyPrompt } from '../shared/NotifyPrompt'
import { RingDialog } from '../shared/RingDialog'
import { notify, unlockAudio } from '../shared/alert'
import { formatRemaining } from '../shared/formatRemaining'
import { useAlertSound, useNotifyPermission } from '../shared/useAlert'
import { useDocumentTitle } from '../shared/useDocumentTitle'
import '../shared/shared.css'
import './TimerTool.css'

type Phase =
  | { status: 'idle' }
  | { status: 'running'; endAt: number; totalMs: number }
  | { status: 'paused'; remainingMs: number; totalMs: number }
  | { status: 'done'; totalMs: number }

const PRESETS = [1, 5, 10, 25]
const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const TICK_MS = 200

/** Keeps digits only and clamps to `max`; '' stays '' so the field can be cleared. */
function clampField(value: string, max: number): string {
  const digits = value.replace(/\D/g, '').slice(0, 3)
  return digits === '' ? '' : String(Math.min(Number(digits), max))
}

export default function TimerTool() {
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('5')
  const [seconds, setSeconds] = useState('0')
  const [phase, setPhase] = useState<Phase>({ status: 'idle' })
  const [nowTs, setNowTs] = useState(() => Date.now())
  const { permission, request } = useNotifyPermission()
  const ids = useId()

  const inputMs = ((Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)) * 1000

  // Count down from an end timestamp, so a throttled tab never drifts.
  const endAt = phase.status === 'running' ? phase.endAt : null
  const runningTotal = phase.status === 'running' ? phase.totalMs : 0
  useEffect(() => {
    if (endAt === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNowTs(t)
      if (t >= endAt) {
        setPhase({ status: 'done', totalMs: runningTotal })
        notify("Time's up!", `Your ${formatRemaining(runningTotal)} timer has finished.`, 'timer')
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [endAt, runningTotal])

  useAlertSound(phase.status === 'done')

  const remainingMs =
    phase.status === 'running'
      ? Math.max(0, phase.endAt - nowTs)
      : phase.status === 'paused'
        ? phase.remainingMs
        : phase.status === 'done'
          ? 0
          : inputMs
  const totalMs = phase.status === 'idle' ? inputMs : phase.totalMs
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0

  const titleText =
    phase.status === 'running'
      ? `${formatRemaining(remainingMs)} · Timer`
      : phase.status === 'paused'
        ? `Paused ${formatRemaining(remainingMs)} · Timer`
        : phase.status === 'done'
          ? "Time's up! · Timer"
          : null
  useDocumentTitle(titleText)

  function setDuration(totalMinutes: number) {
    setHours(String(Math.floor(totalMinutes / 60)))
    setMinutes(String(totalMinutes % 60))
    setSeconds('0')
  }

  function start(ms: number) {
    unlockAudio()
    const t = Date.now()
    setNowTs(t)
    setPhase({ status: 'running', endAt: t + ms, totalMs: ms })
  }

  function pause() {
    if (phase.status !== 'running') return
    setPhase({
      status: 'paused',
      remainingMs: Math.max(0, phase.endAt - Date.now()),
      totalMs: phase.totalMs,
    })
  }

  function resume() {
    if (phase.status !== 'paused') return
    unlockAudio()
    const t = Date.now()
    setNowTs(t)
    setPhase({ status: 'running', endAt: t + phase.remainingMs, totalMs: phase.totalMs })
  }

  const idle = phase.status === 'idle'
  const status =
    phase.status === 'running'
      ? 'Timer running.'
      : phase.status === 'paused'
        ? 'Timer paused.'
        : phase.status === 'done'
          ? "Time's up!"
          : ''

  return (
    <div className="time-tool">
      <section className="card timer-card" aria-label="Countdown timer">
        <div className="timer-dial" data-status={phase.status}>
          <svg className="timer-svg" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="timer-track" cx="100" cy="100" r={RADIUS} />
            <circle
              className="timer-progress"
              cx="100"
              cy="100"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            />
          </svg>
          <p className="timer-readout" role="timer" aria-live="off">
            {formatRemaining(remainingMs)}
          </p>
        </div>
        <p className="sr-only" role="status">
          {status}
        </p>

        <fieldset className="timer-set" disabled={!idle}>
          <legend className="sr-only">Set the timer</legend>
          <div className="timer-fields">
            {(
              [
                ['Hours', hours, setHours, 99],
                ['Minutes', minutes, setMinutes, 59],
                ['Seconds', seconds, setSeconds, 59],
              ] as const
            ).map(([label, value, set, max]) => (
              <div className="field" key={label}>
                <label htmlFor={`${ids}-${label}`}>{label}</label>
                <input
                  id={`${ids}-${label}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => set(clampField(e.target.value, max))}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            ))}
          </div>
          <div className="presets" role="group" aria-label="Quick presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="btn btn-secondary preset-btn"
                onClick={() => setDuration(p)}
              >
                {p} min
              </button>
            ))}
          </div>
        </fieldset>

        <div className="timer-controls">
          {phase.status === 'idle' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={inputMs <= 0}
              onClick={() => start(inputMs)}
            >
              <Icon name="play" size={18} />
              Start
            </button>
          )}
          {phase.status === 'running' && (
            <button type="button" className="btn btn-primary" onClick={pause}>
              <Icon name="pause" size={18} />
              Pause
            </button>
          )}
          {phase.status === 'paused' && (
            <button type="button" className="btn btn-primary" onClick={resume}>
              <Icon name="play" size={18} />
              Resume
            </button>
          )}
          {(phase.status === 'running' || phase.status === 'paused') && (
            <button type="button" className="btn btn-secondary" onClick={() => setPhase({ status: 'idle' })}>
              <Icon name="reset" size={18} />
              Reset
            </button>
          )}
        </div>
      </section>

      <NotifyPrompt permission={permission} onRequest={() => void request()} />
      <p className="hint">
        The timer counts on this device's clock and only runs while this page is open (a background tab is fine).
      </p>

      {phase.status === 'done' && (
        <RingDialog title="Time's up!" onEscape={() => setPhase({ status: 'idle' })}>
          <p className="ring-what">Your {formatRemaining(phase.totalMs)} timer has finished.</p>
          <div className="ring-actions">
            <button type="button" className="btn btn-secondary" onClick={() => start(phase.totalMs)}>
              <Icon name="reset" size={18} />
              Again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-autofocus
              onClick={() => setPhase({ status: 'idle' })}
            >
              Dismiss
            </button>
          </div>
        </RingDialog>
      )}
    </div>
  )
}
