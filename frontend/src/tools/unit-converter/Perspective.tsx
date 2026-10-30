import type { CSSProperties } from 'react'
import { compare, LANDMARKS, temperatureMood, THERMO_MAX, THERMO_MIN } from './comparisons'
import { formatNumber } from './format'

const MAX_DRAWN = 10

/** The closest thing drawn as a row of emoji, the last one cut to the leftover fraction. */
function EmojiRow({ emoji, ratio }: { emoji: string; ratio: number }) {
  if (ratio < 1 || ratio > MAX_DRAWN) return null
  const whole = Math.floor(ratio)
  const part = ratio - whole
  return (
    <div className="uc-emoji-row" aria-hidden="true">
      {Array.from({ length: whole }, (_, i) => (
        <span key={i} className="uc-emoji" style={{ '--i': i } as CSSProperties}>
          {emoji}
        </span>
      ))}
      {part > 0.05 && (
        <span className="uc-emoji uc-emoji-part" style={{ '--i': whole, '--part': part } as CSSProperties}>
          <span>{emoji}</span>
        </span>
      )}
    </div>
  )
}

const pct = (c: number) => ((Math.min(Math.max(c, THERMO_MIN), THERMO_MAX) - THERMO_MIN) / (THERMO_MAX - THERMO_MIN)) * 100

function Thermometer({ celsius }: { celsius: number }) {
  const mood = temperatureMood(celsius)
  return (
    <div className="uc-thermo">
      <p className="uc-persp-lead">
        <span className="uc-persp-emoji" aria-hidden="true">
          {mood.emoji}
        </span>
        {mood.text}
      </p>
      <div
        className="uc-thermo-tube"
        role="img"
        aria-label={`Thermometer at ${formatNumber(celsius)} °C`}
        data-hot={celsius >= 30}
        data-cold={celsius < 0}
      >
        <span className="uc-thermo-bulb" />
        <span className="uc-thermo-fill" style={{ width: `${pct(celsius)}%` }} />
        {LANDMARKS.map((m) => (
          <span key={m.celsius} className="uc-thermo-mark" style={{ left: `${pct(m.celsius)}%` }}>
            <span className="uc-thermo-label">
              {m.label}
              <small>{m.celsius} °C</small>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

interface PerspectiveProps {
  category: string
  valueIn: (unit: string) => number | undefined
}

/** Puts the value next to everyday things, or on a thermometer for temperatures. */
export function Perspective({ category, valueIn }: PerspectiveProps) {
  if (category === 'temperature') {
    const c = valueIn('c')
    if (c === undefined || !Number.isFinite(c)) return null
    return (
      <section className="card uc-persp" aria-labelledby="uc-persp-title">
        <h2 id="uc-persp-title" className="section-title">
          How does that feel?
        </h2>
        <Thermometer celsius={c} />
      </section>
    )
  }

  const [best, ...rest] = compare(category, valueIn)
  if (best === undefined) return null

  return (
    <section className="card uc-persp" aria-labelledby="uc-persp-title">
      <h2 id="uc-persp-title" className="section-title">
        Put it in perspective
      </h2>
      <p className="uc-persp-lead">
        <span className="uc-persp-emoji" aria-hidden="true">
          {best.emoji}
        </span>
        <span>
          That's {best.verb} <strong>{best.text}</strong>.
        </span>
      </p>
      <EmojiRow key={best.text} emoji={best.emoji} ratio={best.ratio} />
      {rest.length > 0 && (
        <ul className="uc-persp-more">
          {rest.map((c) => (
            <li key={c.text}>
              <span aria-hidden="true">{c.emoji}</span> or {c.text}
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Rough, everyday sizes, just for fun.</p>
    </section>
  )
}
