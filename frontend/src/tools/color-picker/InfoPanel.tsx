import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { ColorInfo } from '../../api/colors'
import { WCAG } from './color'
import { SwatchRow } from './SwatchRow'

interface InfoPanelProps {
  /** The color being picked, as "#RRGGBB". */
  hex: string
  /** The latest server answer (may be for an earlier color while a new one loads). */
  info: ColorInfo | null
  error: string | null
  onRetry: () => void
  onPick: (hex: string) => void
}

function formats(info: ColorInfo): [string, string][] {
  const { rgb, hsl, hsv, cmyk } = info
  return [
    ['HEX', info.hex],
    ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
    ['HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
    ['HSV', `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`],
    ['CMYK', `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`],
  ]
}

const HARMONY_LABEL: [keyof ColorInfo['harmonies'], string][] = [
  ['complementary', 'Complementary'],
  ['analogous', 'Analogous'],
  ['triadic', 'Triadic'],
  ['splitComplementary', 'Split complementary'],
  ['tetradic', 'Tetradic'],
]

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the value is still on screen to select by hand.
    }
  }

  return (
    <div className="cp-format">
      <dt>{label}</dt>
      <dd>
        <code>{value}</code>
        <button type="button" className="cp-copy" onClick={copy} aria-label={`Copy ${label} value`}>
          <Icon name="copy" size={16} />
          <span aria-live="polite">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </dd>
    </div>
  )
}

function Badge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className="cp-badge" data-pass={pass}>
      {label} {pass ? 'pass' : 'fail'}
    </span>
  )
}

function ContrastRow({ text, textName, bg, ratio }: { text: string; textName: string; bg: string; ratio: number }) {
  return (
    <li className="cp-contrast-row">
      <span className="cp-preview" style={{ background: bg, color: text }}>
        Aa
      </span>
      <div>
        <p className="cp-ratio">
          {textName} text: <strong>{ratio.toFixed(2)}:1</strong>
        </p>
        <p className="cp-badges">
          <Badge pass={ratio >= WCAG.aa} label="AA" />
          <Badge pass={ratio >= WCAG.aaa} label="AAA" />
        </p>
      </div>
    </li>
  )
}

export function InfoPanel({ hex, info, error, onRetry, onPick }: InfoPanelProps) {
  if (info === null) {
    return (
      <section className="card cp-info" aria-labelledby="cp-info-title">
        <h2 id="cp-info-title" className="section-title">
          Color info
        </h2>
        {error !== null ? (
          <div className="error" role="alert">
            <p>Couldn't look up this color ({error}), but the picker works just fine.</p>
            <button type="button" className="btn btn-secondary retry-btn" onClick={onRetry}>
              <Icon name="reset" size={16} />
              Try again
            </button>
          </div>
        ) : (
          <p className="muted" role="status">
            Looking up your color…
          </p>
        )}
      </section>
    )
  }

  const stale = info.hex.toUpperCase() !== hex.toUpperCase()

  return (
    <section className="card cp-info" aria-labelledby="cp-info-title" aria-busy={stale}>
      <h2 id="cp-info-title" className="section-title">
        Color info
      </h2>

      {error !== null && (
        <div className="error" role="alert">
          <p>Couldn't refresh the info ({error}). What you see is for an earlier color.</p>
          <button type="button" className="btn btn-secondary retry-btn" onClick={onRetry}>
            <Icon name="reset" size={16} />
            Try again
          </button>
        </div>
      )}

      <div className="cp-info-body" data-stale={stale}>
        <p className="cp-name">
          <span className="cp-chip" style={{ background: info.hex }} aria-hidden="true" />
          {info.exactName ? '' : '≈ '}
          {info.name}
        </p>

        <dl className="cp-formats">
          {formats(info).map(([label, value]) => (
            <CopyRow key={label} label={label} value={value} />
          ))}
        </dl>

        <h3 className="cp-subtitle">Contrast</h3>
        <ul className="cp-contrast">
          <ContrastRow text="#FFFFFF" textName="White" bg={info.hex} ratio={info.contrast.white} />
          <ContrastRow text="#000000" textName="Black" bg={info.hex} ratio={info.contrast.black} />
        </ul>
        <p className="cp-sample" style={{ background: info.hex, color: info.contrast.bestText }}>
          The quick brown fox jumps over the lazy dog.
        </p>

        <h3 className="cp-subtitle">Shades</h3>
        <SwatchRow colors={info.shades} current={hex} onPick={onPick} />

        <h3 className="cp-subtitle">Harmonies</h3>
        <div className="cp-harmonies">
          {HARMONY_LABEL.map(([key, label]) => (
            <div key={key} className="cp-harmony">
              <p className="hint">{label}</p>
              <SwatchRow colors={info.harmonies[key]} current={hex} onPick={onPick} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
