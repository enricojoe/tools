import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '../../components/Icon'
import { prefersReducedMotion, randomInt } from '../shared/random'
import './DiceTool.css'

const SIDES = [4, 6, 8, 10, 12, 20, 100] as const
const MAX_DICE = 10
const MAX_MODIFIER = 99
const ROLL_MS = 650
const FLICKER_MS = 70
const HISTORY_SIZE = 10

// Which cells of a 3×3 grid hold a pip, per d6 face.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

interface Die {
  value: number
  held: boolean
}

interface Roll {
  id: number
  notation: string
  values: number[]
  total: number
}

function rollDie(sides: number): number {
  return randomInt(sides) + 1
}

function freshDice(count: number, sides: number): Die[] {
  return Array.from({ length: count }, () => ({ value: rollDie(sides), held: false }))
}

function notation(count: number, sides: number, modifier: number): string {
  const mod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ''
  return `${count}d${sides}${mod}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function Face({ value, sides }: { value: number; sides: number }) {
  if (sides !== 6) return <span className="dc-number">{value}</span>
  return (
    <span className={value === 1 ? 'dc-pips dc-pips-one' : 'dc-pips'}>
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={PIPS[value].includes(cell) ? 'dc-pip dc-pip-on' : 'dc-pip'} />
      ))}
    </span>
  )
}

export default function DiceTool() {
  const [count, setCount] = useState(2)
  const [sides, setSides] = useState(6)
  const [modifier, setModifier] = useState(0)
  const [dice, setDice] = useState(() => freshDice(2, 6))
  // Faces shown while the dice tumble; null when they're at rest.
  const [flicker, setFlicker] = useState<number[] | null>(null)
  const [rolled, setRolled] = useState(false)
  const [history, setHistory] = useState<Roll[]>([])
  const timers = useRef<{ flicker?: number; done?: number }>({})
  const nextId = useRef(0)
  const ids = useId()

  const rolling = flicker !== null
  const sum = dice.reduce((s, d) => s + d.value, 0)
  const total = sum + modifier
  const allHeld = dice.every((d) => d.held)

  useEffect(() => {
    const t = timers.current
    return () => {
      window.clearInterval(t.flicker)
      window.clearTimeout(t.done)
    }
  }, [])

  function setup(nextCount: number, nextSides: number) {
    setCount(nextCount)
    setSides(nextSides)
    setDice(freshDice(nextCount, nextSides))
    setRolled(false)
  }

  function roll() {
    if (rolling || allHeld) return
    // The result is settled now; the tumble is only for show.
    const next = dice.map((d) => (d.held ? d : { ...d, value: rollDie(sides) }))
    const finish = () => {
      window.clearInterval(timers.current.flicker)
      setFlicker(null)
      setDice(next)
      setRolled(true)
      const values = next.map((d) => d.value)
      const rollTotal = values.reduce((s, v) => s + v, 0) + modifier
      setHistory((h) =>
        [{ id: nextId.current++, notation: notation(count, sides, modifier), values, total: rollTotal }, ...h].slice(
          0,
          HISTORY_SIZE,
        ),
      )
    }
    if (prefersReducedMotion()) {
      finish()
      return
    }
    const tumble = () => setFlicker(dice.map((d) => (d.held ? d.value : rollDie(sides))))
    tumble()
    timers.current.flicker = window.setInterval(tumble, FLICKER_MS)
    timers.current.done = window.setTimeout(finish, ROLL_MS)
  }

  function toggleHold(i: number) {
    if (rolling) return
    setDice((ds) => ds.map((d, j) => (j === i ? { ...d, held: !d.held } : d)))
  }

  const canHold = rolled && count > 1

  return (
    <div className="dc-tool">
      <section className="card dc-stage" aria-label="Dice">
        <ul className={rolling ? 'dc-tray dc-rolling' : 'dc-tray'}>
          {dice.map((d, i) => {
            const shown = flicker?.[i] ?? d.value
            const isMax = !rolling && rolled && d.value === sides
            const isMin = !rolling && rolled && d.value === 1
            return (
              <li key={i}>
                <button
                  type="button"
                  className={['dc-die', d.held && 'dc-held', isMax && 'dc-max', isMin && 'dc-min'].filter(Boolean).join(' ')}
                  onClick={() => toggleHold(i)}
                  disabled={!canHold}
                  aria-pressed={canHold ? d.held : undefined}
                  aria-label={`Die ${i + 1}: ${shown}${d.held ? ', held' : ''}`}
                  style={{ '--tumble-delay': `${(i % 5) * 40}ms` } as CSSProperties}
                >
                  <Face value={shown} sides={sides} />
                  {sides !== 6 && <span className="dc-tag">d{sides}</span>}
                  {d.held && <span className="dc-held-tag">held</span>}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="dc-total" role="status">
          {rolling ? (
            <p className="dc-total-label">Rolling…</p>
          ) : rolled ? (
            <>
              <p className="dc-total-label">
                {count > 1 || modifier !== 0
                  ? `${dice.map((d) => d.value).join(' + ')}${modifier ? ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` : ''} =`
                  : `You rolled`}
              </p>
              <p className="dc-total-value">{total}</p>
            </>
          ) : (
            <p className="dc-total-label">Pick your dice, then roll.</p>
          )}
        </div>

        <div className="dc-actions">
          <button type="button" className="btn btn-primary" onClick={roll} disabled={rolling || allHeld}>
            <Icon name="dice" size={18} />
            Roll {notation(count, sides, modifier)}
          </button>
          {dice.some((d) => d.held) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDice((ds) => ds.map((d) => ({ ...d, held: false })))}
              disabled={rolling}
            >
              Release all
            </button>
          )}
        </div>
        <p className="hint">{canHold ? 'Click a die to hold it; held dice keep their number on the next roll.' : ' '}</p>
      </section>

      <div className="dc-side">
        <section className="card dc-settings">
          <fieldset className="dc-fieldset" disabled={rolling}>
            <legend className="dc-title">Die</legend>
            <div className="dc-chips">
              {SIDES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === sides ? 'dc-chip dc-chip-on' : 'dc-chip'}
                  aria-pressed={s === sides}
                  onClick={() => setup(count, s)}
                >
                  d{s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="dc-row">
            <div className="dc-field">
              <span className="dc-title" id={`${ids}-count`}>
                How many
              </span>
              <div className="dc-stepper" role="group" aria-labelledby={`${ids}-count`}>
                <button
                  type="button"
                  onClick={() => setup(count - 1, sides)}
                  disabled={rolling || count <= 1}
                  aria-label="One die fewer"
                >
                  −
                </button>
                <output aria-live="polite">{count}</output>
                <button
                  type="button"
                  onClick={() => setup(count + 1, sides)}
                  disabled={rolling || count >= MAX_DICE}
                  aria-label="One die more"
                >
                  +
                </button>
              </div>
            </div>

            <div className="dc-field">
              <label className="dc-title" htmlFor={`${ids}-mod`}>
                Modifier
              </label>
              <input
                id={`${ids}-mod`}
                className="dc-input"
                type="number"
                inputMode="numeric"
                min={-MAX_MODIFIER}
                max={MAX_MODIFIER}
                value={modifier}
                disabled={rolling}
                onChange={(e) => {
                  const n = Math.trunc(Number(e.target.value))
                  setModifier(Number.isFinite(n) ? clamp(n, -MAX_MODIFIER, MAX_MODIFIER) : 0)
                }}
              />
            </div>
          </div>
          <p className="hint">Added to the total, like the +2 in 1d20+2. Rolled fairly in your browser.</p>
        </section>

        <section className="card dc-history" aria-labelledby={`${ids}-history`}>
          <div className="dc-head">
            <h2 className="dc-title" id={`${ids}-history`}>
              Recent rolls
            </h2>
            {history.length > 0 && (
              <button type="button" className="dc-chip" onClick={() => setHistory([])}>
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="hint">No rolls yet.</p>
          ) : (
            <ol className="dc-history-list">
              {history.map((r) => (
                <li key={r.id}>
                  <span className="dc-history-notation">{r.notation}</span>
                  <span className="dc-history-values">{r.values.join(', ')}</span>
                  <strong>{r.total}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
