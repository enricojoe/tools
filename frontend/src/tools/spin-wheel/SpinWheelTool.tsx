import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { prefersReducedMotion, randomInt, shuffled } from '../shared/random'
import { MAX_ENTRIES, clip, parseEntries, planSpin, sliceColor, slicePath } from './wheel'
import './SpinWheelTool.css'

const ENTRIES_KEY = 'spin-wheel:entries'
const DEFAULT_ENTRIES = ['Pizza', 'Sushi', 'Nasi goreng', 'Tacos', 'Ramen', 'Burgers'].join('\n')
const SPIN_MS = 5000
const HISTORY_SIZE = 10
const RADIUS = 96

function loadEntries(): string {
  try {
    return localStorage.getItem(ENTRIES_KEY) ?? DEFAULT_ENTRIES
  } catch {
    return DEFAULT_ENTRIES
  }
}

function storeEntries(text: string): void {
  try {
    localStorage.setItem(ENTRIES_KEY, text)
  } catch {
    // Storage unavailable: the entries just won't survive a reload.
  }
}

// Smaller labels as slices get thinner.
function labelStyle(count: number): { size: number; chars: number } {
  if (count <= 8) return { size: 9, chars: 14 }
  if (count <= 16) return { size: 7, chars: 16 }
  if (count <= 32) return { size: 5, chars: 20 }
  return { size: 3.5, chars: 24 }
}

/** The text without the first line that reads `label`. */
function withoutEntry(text: string, label: string): string {
  const lines = text.split('\n')
  const i = lines.findIndex((line) => line.trim() === label)
  return i === -1 ? text : [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n')
}

export default function SpinWheelTool() {
  const [text, setText] = useState(loadEntries)
  const [rotation, setRotation] = useState(0)
  const [spinMs, setSpinMs] = useState(0)
  const [winner, setWinner] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const doneTimer = useRef<number | undefined>(undefined)
  const ids = useId()

  const entries = useMemo(() => parseEntries(text), [text])
  const spinning = spinMs > 0
  const canSpin = entries.length >= 2 && !spinning
  const tooMany = text.split('\n').filter((l) => l.trim()).length > MAX_ENTRIES

  useEffect(() => storeEntries(text), [text])
  useEffect(() => () => window.clearTimeout(doneTimer.current), [])

  function spin() {
    if (!canSpin) return
    const ms = prefersReducedMotion() ? 0 : SPIN_MS
    const { winner: index, rotation: next } = planSpin(rotation, entries.length, 5 + randomInt(4))
    const label = entries[index]
    setWinner(null)
    setSpinMs(ms)
    setRotation(next)
    const finish = () => {
      setSpinMs(0)
      setWinner(label)
      setHistory((h) => [label, ...h].slice(0, HISTORY_SIZE))
    }
    if (ms === 0) finish()
    else doneTimer.current = window.setTimeout(finish, ms)
  }

  function removeWinner() {
    if (winner === null) return
    setText((t) => withoutEntry(t, winner))
    setWinner(null)
  }

  const per = 360 / Math.max(entries.length, 1)
  const label = labelStyle(entries.length)

  return (
    <div className="sw-tool">
      <section className="card sw-stage" aria-label="Wheel">
        <div className="sw-wheel-wrap">
          <svg className="sw-pointer" viewBox="0 0 24 28" aria-hidden="true">
            <path d="M2 2h20L12 26z" />
          </svg>
          <button
            type="button"
            className="sw-wheel"
            onClick={spin}
            disabled={!canSpin}
            aria-label={spinning ? 'Spinning…' : 'Spin the wheel'}
          >
            <svg viewBox="-100 -100 200 200" aria-hidden="true">
              <g
                className="sw-disc"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? `transform ${spinMs}ms cubic-bezier(0.15, 0.6, 0.1, 1)` : 'none',
                }}
              >
                {entries.length === 0 && <circle r={RADIUS} className="sw-empty" />}
                {entries.length === 1 && <circle r={RADIUS} fill={sliceColor(0, 1).fill} />}
                {entries.length > 1 &&
                  entries.map((_, i) => (
                    <path key={i} d={slicePath(i * per, (i + 1) * per, RADIUS)} fill={sliceColor(i, entries.length).fill} />
                  ))}
                {entries.map((entry, i) => (
                  <text
                    key={i}
                    transform={`rotate(${(i + 0.5) * per - 90})`}
                    x={RADIUS - 8}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={label.size}
                    fill={sliceColor(i, entries.length).text}
                    className="sw-label"
                  >
                    {clip(entry, label.chars)}
                  </text>
                ))}
                <circle r={RADIUS} className="sw-rim" />
              </g>
              <circle r={16} className="sw-hub" />
              <text className="sw-hub-text" dominantBaseline="central" textAnchor="middle">
                SPIN
              </text>
            </svg>
          </button>
        </div>

        <div className="sw-result" role="status">
          {winner !== null ? (
            <>
              <p className="sw-result-label">The wheel picked</p>
              <p className="sw-winner">{winner}</p>
            </>
          ) : (
            <p className="sw-result-label">
              {spinning ? 'Round and round it goes…' : entries.length < 2 ? 'Add at least two entries to spin.' : 'Click the wheel or press Spin.'}
            </p>
          )}
        </div>

        <div className="sw-actions">
          <button type="button" className="btn btn-primary" onClick={spin} disabled={!canSpin}>
            <Icon name="wheel" size={18} />
            {winner !== null ? 'Spin again' : 'Spin'}
          </button>
          {winner !== null && (
            <button type="button" className="btn btn-secondary" onClick={removeWinner}>
              <Icon name="trash" size={18} />
              Remove “{clip(winner, 20)}”
            </button>
          )}
        </div>
      </section>

      <div className="sw-side">
        <section className="card sw-entries">
          <div className="sw-head">
            <label htmlFor={`${ids}-entries`} className="sw-title">
              Entries <span className="sw-count">{entries.length}</span>
            </label>
            <div className="sw-head-actions">
              <button
                type="button"
                className="sw-chip"
                onClick={() => setText(shuffled(entries).join('\n'))}
                disabled={spinning || entries.length < 2}
              >
                Shuffle
              </button>
              <button
                type="button"
                className="sw-chip"
                onClick={() => setText([...entries].sort((a, b) => a.localeCompare(b)).join('\n'))}
                disabled={spinning || entries.length < 2}
              >
                A–Z
              </button>
              <button type="button" className="sw-chip" onClick={() => setText('')} disabled={spinning || text === ''}>
                Clear
              </button>
            </div>
          </div>
          <textarea
            id={`${ids}-entries`}
            className="sw-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={spinning}
            placeholder={'One entry per line, like\nAlice\nBudi\nChen'}
            spellCheck={false}
          />
          <p className={tooMany ? 'hint hint-error' : 'hint'}>
            {tooMany
              ? `Only the first ${MAX_ENTRIES} entries go on the wheel.`
              : 'One per line. Write something twice to give it double the chance. Saved on this device.'}
          </p>
        </section>

        <section className="card sw-history" aria-labelledby={`${ids}-history`}>
          <div className="sw-head">
            <h2 className="sw-title" id={`${ids}-history`}>
              Recent picks
            </h2>
            {history.length > 0 && (
              <button type="button" className="sw-chip" onClick={() => setHistory([])}>
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="hint">Nothing picked yet.</p>
          ) : (
            <ol className="sw-history-list">
              {history.map((h, i) => (
                <li key={`${i}-${h}`}>{h}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
