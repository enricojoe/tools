import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { SessionKind } from '../../api/pomodoro'
import { NotifyPrompt } from '../shared/NotifyPrompt'
import { notify, startAlertSound, unlockAudio } from '../shared/alert'
import { formatRemaining } from '../shared/formatRemaining'
import { useNotifyPermission } from '../shared/useAlert'
import { useDocumentTitle } from '../shared/useDocumentTitle'
import { PomodoroSettings } from './PomodoroSettings'
import { TodayPanel } from './TodayPanel'
import {
  PHASE_LABEL,
  loadSettings,
  nextPhase,
  phaseMinutes,
  saveSettings,
  type Settings,
} from './phases'
import { usePomodoroToday } from './usePomodoroToday'
import '../shared/shared.css'
import './PomodoroTool.css'

type Run =
  | { status: 'idle' }
  | { status: 'running'; endAt: number; totalMs: number }
  | { status: 'paused'; remainingMs: number; totalMs: number }

const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const TICK_MS = 200
const BEEP_MS = 3000

export default function PomodoroTool() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [kind, setKind] = useState<SessionKind>('focus')
  /** Focus sessions finished in the current cycle (a long break resets it). */
  const [focusDone, setFocusDone] = useState(0)
  const [run, setRun] = useState<Run>({ status: 'idle' })
  const [label, setLabel] = useState('')
  const [nowTs, setNowTs] = useState(() => Date.now())
  const { permission, request } = useNotifyPermission()
  const { day, error, unsaved, record, retry } = usePomodoroToday()
  const labelId = useId()

  useEffect(() => saveSettings(settings), [settings])

  function startPhase(phase: SessionKind, current: Settings) {
    unlockAudio()
    const t = Date.now()
    const ms = phaseMinutes(phase, current) * 60_000
    setNowTs(t)
    setRun({ status: 'running', endAt: t + ms, totalMs: ms })
  }

  /** Moves to `next`, and starts it right away when auto-start is on. */
  function advance(next: { kind: SessionKind; focusDone: number }) {
    setKind(next.kind)
    setFocusDone(next.focusDone)
    if (settings.autoStart) startPhase(next.kind, settings)
    else setRun({ status: 'idle' })
  }

  // Latest-closure handler for the interval below, so the interval itself only restarts with the end time.
  const completeRef = useRef<() => void>(() => {})
  useEffect(() => {
    completeRef.current = () => {
      if (run.status !== 'running') return
      const next = nextPhase(kind, focusDone, settings.longBreakEvery)
      void record({
        kind,
        durationSeconds: Math.max(1, Math.round(run.totalMs / 1000)),
        label: kind === 'focus' && label.trim() ? label.trim() : undefined,
        completedAt: new Date(run.endAt).toISOString(),
      })
      notify(
        `${PHASE_LABEL[kind]} finished`,
        `Up next: ${PHASE_LABEL[next.kind].toLowerCase()}, ${phaseMinutes(next.kind, settings)} min.`,
        'pomodoro',
      )
      const stopBeep = startAlertSound()
      setTimeout(stopBeep, BEEP_MS)
      advance(next)
    }
  })

  // Count down to an end timestamp, so a throttled background tab never drifts.
  const endAt = run.status === 'running' ? run.endAt : null
  useEffect(() => {
    if (endAt === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNowTs(t)
      if (t >= endAt) {
        clearInterval(id)
        completeRef.current()
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [endAt])

  const totalMs = run.status === 'idle' ? phaseMinutes(kind, settings) * 60_000 : run.totalMs
  const remainingMs =
    run.status === 'running' ? Math.max(0, run.endAt - nowTs) : run.status === 'paused' ? run.remainingMs : totalMs
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0

  useDocumentTitle(
    run.status === 'running'
      ? `${formatRemaining(remainingMs)} · ${PHASE_LABEL[kind]}`
      : run.status === 'paused'
        ? `Paused ${formatRemaining(remainingMs)} · ${PHASE_LABEL[kind]}`
        : null,
  )

  function pause() {
    if (run.status !== 'running') return
    setRun({ status: 'paused', remainingMs: Math.max(0, run.endAt - Date.now()), totalMs: run.totalMs })
  }

  function resume() {
    if (run.status !== 'paused') return
    unlockAudio()
    const t = Date.now()
    setNowTs(t)
    setRun({ status: 'running', endAt: t + run.remainingMs, totalMs: run.totalMs })
  }

  /** Moves on without logging. Skipping a focus session doesn't count toward the long break. */
  function skip() {
    advance(
      kind === 'focus'
        ? { kind: 'short_break', focusDone }
        : nextPhase(kind, focusDone, settings.longBreakEvery),
    )
  }

  const cycleLength = settings.longBreakEvery
  const round = kind === 'focus' ? Math.min(focusDone + 1, cycleLength) : Math.min(Math.max(focusDone, 1), cycleLength)
  const stateText = run.status === 'running' ? 'running' : run.status === 'paused' ? 'paused' : 'ready'

  return (
    <div className="time-tool">
      <section className="card pomo-card" aria-label="Pomodoro timer">
        <p className="pomo-phase" data-kind={kind}>
          {PHASE_LABEL[kind]}
        </p>

        <div className="pomo-dial" data-kind={kind} data-status={run.status}>
          <svg className="pomo-svg" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="pomo-track" cx="100" cy="100" r={RADIUS} />
            <circle
              className="pomo-progress"
              cx="100"
              cy="100"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            />
          </svg>
          <p className="pomo-readout" role="timer" aria-live="off">
            {formatRemaining(remainingMs)}
          </p>
        </div>

        <div className="pomo-rounds">
          <ol className="pomo-dots" aria-hidden="true">
            {Array.from({ length: cycleLength }, (_, i) => (
              <li
                key={i}
                className="pomo-dot"
                data-state={i < focusDone ? 'done' : kind === 'focus' && i === focusDone ? 'current' : 'todo'}
              />
            ))}
          </ol>
          <p className="hint">
            Round {round} of {cycleLength}
          </p>
        </div>
        <p className="sr-only" role="status">
          {PHASE_LABEL[kind]}, {stateText}. Round {round} of {cycleLength}.
        </p>

        {kind === 'focus' && (
          <div className="field pomo-label">
            <label htmlFor={labelId}>What are you working on?</label>
            <input
              id={labelId}
              type="text"
              maxLength={100}
              autoComplete="off"
              placeholder="Optional"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        )}

        <div className="pomo-controls">
          {run.status === 'idle' && (
            <button type="button" className="btn btn-primary" onClick={() => startPhase(kind, settings)}>
              <Icon name="play" size={18} />
              Start
            </button>
          )}
          {run.status === 'running' && (
            <button type="button" className="btn btn-primary" onClick={pause}>
              <Icon name="pause" size={18} />
              Pause
            </button>
          )}
          {run.status === 'paused' && (
            <button type="button" className="btn btn-primary" onClick={resume}>
              <Icon name="play" size={18} />
              Resume
            </button>
          )}
          {run.status !== 'idle' && (
            <button type="button" className="btn btn-secondary" onClick={() => setRun({ status: 'idle' })}>
              <Icon name="reset" size={18} />
              Reset
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={skip}>
            <Icon name="skip" size={18} />
            Skip
          </button>
        </div>
      </section>

      <PomodoroSettings settings={settings} onChange={setSettings} />

      <TodayPanel day={day} error={error} unsaved={unsaved} onRetry={() => void retry()} />

      <NotifyPrompt permission={permission} onRequest={() => void request()} />
      <p className="hint">
        The timer counts on this device's clock and only runs while this page is open (a background tab is fine).
        Finished phases are logged to the server; skipped and reset ones aren't.
      </p>
    </div>
  )
}
