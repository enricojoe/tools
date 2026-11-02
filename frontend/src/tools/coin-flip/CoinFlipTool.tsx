import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { prefersReducedMotion, randomInt } from '../shared/random'
import './CoinFlipTool.css'

type Side = 'heads' | 'tails'

const BATCHES = [1, 10, 100] as const
const FLIP_MS = 1100
const RECENT_SIZE = 40
const MAX_LABEL = 16

interface Streak {
  side: Side
  length: number
}

function flipOnce(): Side {
  return randomInt(2) === 0 ? 'heads' : 'tails'
}

/** Heads rests at 0° (mod 360) and tails at 180°; always turns forward at least `turns` times. */
function restingRotation(current: number, side: Side, turns: number): number {
  const base = Math.ceil((current + turns * 360) / 360) * 360
  return base + (side === 'tails' ? 180 : 0)
}

function streaks(flips: Side[]): { current: Streak | null; longest: Streak | null } {
  if (flips.length === 0) return { current: null, longest: null }
  let current: Streak = { side: flips[0], length: 0 }
  let longest = current
  for (const side of flips) {
    current = current.side === side ? { side, length: current.length + 1 } : { side, length: 1 }
    if (current.length > longest.length) longest = current
  }
  return { current, longest }
}

export default function CoinFlipTool() {
  const [flips, setFlips] = useState<Side[]>([])
  const [rotation, setRotation] = useState(0)
  const [flipping, setFlipping] = useState(false)
  // Bumped per flip; its parity swaps between two identical hop animations so
  // the hop restarts without remounting the coin (which would skip the turn).
  const [hop, setHop] = useState(0)
  const [lastBatch, setLastBatch] = useState<Side[] | null>(null)
  const [labels, setLabels] = useState({ heads: 'Heads', tails: 'Tails' })
  const doneTimer = useRef<number | undefined>(undefined)
  const ids = useId()

  useEffect(() => () => window.clearTimeout(doneTimer.current), [])

  const stats = useMemo(() => {
    const heads = flips.filter((f) => f === 'heads').length
    return { heads, tails: flips.length - heads, ...streaks(flips) }
  }, [flips])

  const name = (side: Side) => labels[side].trim() || (side === 'heads' ? 'Heads' : 'Tails')

  function flip(times: number) {
    if (flipping) return
    const batch = Array.from({ length: times }, flipOnce)
    const shown = batch[batch.length - 1]
    const ms = prefersReducedMotion() ? 0 : FLIP_MS
    setLastBatch(null)
    setRotation((r) => restingRotation(r, shown, 4 + randomInt(3)))
    setHop((h) => h + 1)
    const finish = () => {
      setFlipping(false)
      setLastBatch(batch)
      setFlips((f) => [...f, ...batch])
    }
    if (ms === 0) {
      finish()
      return
    }
    setFlipping(true)
    doneTimer.current = window.setTimeout(finish, ms)
  }

  function reset() {
    setFlips([])
    setLastBatch(null)
  }

  const total = flips.length
  const headsPct = total ? (stats.heads / total) * 100 : 50
  const batchHeads = lastBatch?.filter((f) => f === 'heads').length ?? 0
  const recent = flips.slice(-RECENT_SIZE).reverse()

  return (
    <div className="cf-tool">
      <section className="card cf-stage" aria-label="Coin">
        <div className="cf-arena">
          <div className={hop > 0 ? `cf-hop cf-hopping-${hop % 2}` : 'cf-hop'}>
            <button
              type="button"
              className="cf-coin"
              onClick={() => flip(1)}
              disabled={flipping}
              aria-label={flipping ? 'Flipping…' : 'Flip the coin'}
              style={{
                transform: `rotateY(${rotation}deg)`,
                transition: flipping ? `transform ${FLIP_MS}ms cubic-bezier(0.25, 0.8, 0.3, 1)` : 'none',
              }}
            >
              <span className="cf-face cf-heads" aria-hidden="true">
                <span className="cf-face-mark">★</span>
                <span className="cf-face-name">{name('heads')}</span>
              </span>
              <span className="cf-face cf-tails" aria-hidden="true">
                <span className="cf-face-mark">✿</span>
                <span className="cf-face-name">{name('tails')}</span>
              </span>
            </button>
          </div>
          <span className={hop > 0 ? `cf-shadow cf-shadow-hopping-${hop % 2}` : 'cf-shadow'} />
        </div>

        <div className="cf-result" role="status">
          {flipping ? (
            <p className="cf-result-label">In the air…</p>
          ) : lastBatch === null ? (
            <p className="cf-result-label">Click the coin or press Flip.</p>
          ) : lastBatch.length === 1 ? (
            <>
              <p className="cf-result-label">It landed on</p>
              <p className="cf-result-value">{name(lastBatch[0])}</p>
            </>
          ) : (
            <>
              <p className="cf-result-label">{lastBatch.length} flips</p>
              <p className="cf-result-value">
                {batchHeads} {name('heads')} · {lastBatch.length - batchHeads} {name('tails')}
              </p>
            </>
          )}
        </div>

        <div className="cf-actions">
          {BATCHES.map((n) => (
            <button
              key={n}
              type="button"
              className={n === 1 ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => flip(n)}
              disabled={flipping}
            >
              {n === 1 && <Icon name="coin" size={18} />}
              {n === 1 ? 'Flip' : `Flip ${n}×`}
            </button>
          ))}
        </div>
      </section>

      <div className="cf-side">
        <section className="card cf-stats" aria-labelledby={`${ids}-stats`}>
          <div className="cf-head">
            <h2 className="cf-title" id={`${ids}-stats`}>
              Tally <span className="cf-count">{total}</span>
            </h2>
            <button type="button" className="cf-chip" onClick={reset} disabled={flipping || total === 0}>
              <Icon name="reset" size={14} />
              Reset
            </button>
          </div>

          <div className="cf-split">
            <div className="cf-split-side">
              <span className="cf-split-name">{name('heads')}</span>
              <strong>{stats.heads}</strong>
              <span className="hint">{total ? `${headsPct.toFixed(1)}%` : '—'}</span>
            </div>
            <div className="cf-split-side cf-split-tails">
              <span className="cf-split-name">{name('tails')}</span>
              <strong>{stats.tails}</strong>
              <span className="hint">{total ? `${(100 - headsPct).toFixed(1)}%` : '—'}</span>
            </div>
          </div>
          <div
            className="cf-bar"
            role="img"
            aria-label={total ? `${headsPct.toFixed(1)}% ${name('heads')}` : 'No flips yet'}
          >
            <span className="cf-bar-heads" style={{ width: `${headsPct}%` }} />
          </div>

          <dl className="cf-streaks">
            <div>
              <dt>Current streak</dt>
              <dd>{stats.current ? `${stats.current.length} × ${name(stats.current.side)}` : '—'}</dd>
            </div>
            <div>
              <dt>Longest streak</dt>
              <dd>{stats.longest ? `${stats.longest.length} × ${name(stats.longest.side)}` : '—'}</dd>
            </div>
          </dl>

          {recent.length > 0 && (
            <div className="cf-recent">
              <p className="cf-title">Latest first</p>
              <ol className="cf-recent-list" aria-label="Recent flips, latest first">
                {recent.map((side, i) => (
                  <li key={total - i} className={`cf-dot cf-dot-${side}`} title={name(side)}>
                    {name(side).charAt(0).toUpperCase()}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="card cf-labels">
          <h2 className="cf-title">Name the sides</h2>
          <div className="cf-label-row">
            {(['heads', 'tails'] as const).map((side) => (
              <div key={side} className="cf-field">
                <label htmlFor={`${ids}-${side}`}>{side === 'heads' ? 'Heads (★)' : 'Tails (✿)'}</label>
                <input
                  id={`${ids}-${side}`}
                  className="cf-input"
                  type="text"
                  maxLength={MAX_LABEL}
                  value={labels[side]}
                  onChange={(e) => setLabels((l) => ({ ...l, [side]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <p className="hint">Use it for a yes/no, or who goes first. Every flip is a fair 50/50, made in your browser.</p>
        </section>
      </div>
    </div>
  )
}
