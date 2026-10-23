import { useEffect, useId, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useDocumentTitle } from '../shared/useDocumentTitle'
import { SavedRuns } from './SavedRuns'
import { describeElapsed, formatElapsed } from './format'
import { MAX_ELAPSED_MS, MAX_LAPS, useStopwatch } from './useStopwatch'
import { useSavedRuns } from './useSavedRuns'
import '../shared/shared.css'
import './StopwatchTool.css'

/** True when the key event came from somewhere the user is typing. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

export default function StopwatchTool() {
  const { status, elapsedMs, laps, start, pause, reset, lap } = useStopwatch()
  const { runs, error, retry, save, remove } = useSavedRuns()
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const labelId = useId()

  useDocumentTitle(status === 'running' ? `${formatElapsed(elapsedMs)} · Stopwatch` : null)

  function handleStart() {
    setSaved(false)
    setSaveError(null)
    start()
    setAnnouncement(status === 'paused' ? 'Resumed.' : 'Started.')
  }

  function handlePause() {
    pause()
    setAnnouncement(`Paused at ${describeElapsed(elapsedMs)}.`)
  }

  function handleLap() {
    if (status !== 'running' || laps.length >= MAX_LAPS) return
    lap()
    setAnnouncement(`Lap ${laps.length + 1}, ${describeElapsed(elapsedMs - (laps.at(-1)?.totalMs ?? 0))}.`)
  }

  function handleReset() {
    reset()
    setSaved(false)
    setSaveError(null)
    setAnnouncement('Reset.')
  }

  async function handleSave() {
    const total = Math.min(MAX_ELAPSED_MS, Math.max(1, Math.round(elapsedMs)))
    setSaving(true)
    setSaveError(null)
    const message = await save({
      label: label.trim() || undefined,
      elapsedMs: total,
      laps: laps.length > 0 ? laps.map((l) => l.lapMs) : undefined,
    })
    setSaving(false)
    if (message === null) {
      setSaved(true)
      setAnnouncement('Run saved.')
    } else {
      setSaveError(message)
    }
  }

  // Keyboard shortcuts read the latest handlers through this effect's closure.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return
      const onButton = e.target instanceof HTMLElement && e.target.closest('button') !== null
      if (e.code === 'Space') {
        // A focused button already turns Space into a click.
        if (onButton) return
        e.preventDefault()
        if (status === 'running') handlePause()
        else handleStart()
      } else if (e.key === 'l' || e.key === 'L') {
        handleLap()
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const { fastest, slowest } = useMemo(() => {
    if (laps.length < 2) return { fastest: null, slowest: null }
    const times = laps.map((l) => l.lapMs)
    const min = Math.min(...times)
    const max = Math.max(...times)
    return min === max ? { fastest: null, slowest: null } : { fastest: min, slowest: max }
  }, [laps])

  const canSave = status === 'paused' && elapsedMs > 0 && !saving && !saved
  const lapsFull = laps.length >= MAX_LAPS

  return (
    <div className="time-tool">
      <section className="card sw-card" aria-label="Stopwatch">
        <p className="sw-readout" data-status={status} role="timer" aria-live="off">
          {formatElapsed(elapsedMs)}
        </p>
        <p className="sr-only" role="status">
          {announcement}
        </p>

        <div className="sw-controls">
          {status === 'running' ? (
            <button type="button" className="btn btn-primary" onClick={handlePause}>
              <Icon name="pause" size={18} />
              Pause
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleStart} disabled={elapsedMs >= MAX_ELAPSED_MS}>
              <Icon name="play" size={18} />
              {status === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={handleLap} disabled={status !== 'running' || lapsFull}>
            <Icon name="flag" size={18} />
            Lap
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={status === 'idle'}>
            <Icon name="reset" size={18} />
            Reset
          </button>
        </div>

        <div className="sw-save">
          <div className="field sw-label">
            <label htmlFor={labelId}>Label</label>
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
          <button type="button" className="btn btn-secondary" onClick={() => void handleSave()} disabled={!canSave}>
            <Icon name="download" size={18} />
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
        {saveError !== null && (
          <p className="error" role="alert">
            Couldn't save this run: {saveError}. The stopwatch is fine, so you can try again.
          </p>
        )}

        <p className="hint">
          Shortcuts: <kbd>Space</kbd> start / pause, <kbd>L</kbd> lap, <kbd>R</kbd> reset.
        </p>
      </section>

      {laps.length > 0 && (
        <section className="card" aria-labelledby="laps-title">
          <h2 id="laps-title" className="section-title">
            Laps
          </h2>
          <div className="sw-table-wrap">
            <table className="sw-laps">
              <thead>
                <tr>
                  <th scope="col">Lap</th>
                  <th scope="col">Lap time</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...laps].reverse().map((l) => (
                  <tr
                    key={l.n}
                    data-mark={l.lapMs === fastest ? 'fastest' : l.lapMs === slowest ? 'slowest' : undefined}
                  >
                    <th scope="row">
                      {l.n}
                      {l.lapMs === fastest && <span className="sw-tag"> Fastest</span>}
                      {l.lapMs === slowest && <span className="sw-tag"> Slowest</span>}
                    </th>
                    <td>{formatElapsed(l.lapMs)}</td>
                    <td>{formatElapsed(l.totalMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SavedRuns runs={runs} error={error} onRetry={retry} onDelete={remove} />

      <p className="hint">
        Time is measured from timestamps, so a background tab doesn't drift. It only runs while this page is open, and
        stops at 24 hours. Saved runs are kept in the server's memory.
      </p>
    </div>
  )
}
