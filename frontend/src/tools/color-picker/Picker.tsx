import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Icon } from '../../components/Icon'
import { clampUnit, normalizeHex, type HsvColor } from './color'

interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperApi
  }
}

interface PickerProps {
  color: HsvColor
  hex: string
  onChange: (color: HsvColor) => void
  /** Called with a valid "#RRGGBB" when the typed text or the eyedropper gives a new color. */
  onHex: (hex: string) => void
}

export function Picker({ color, hex, onChange, onHex }: PickerProps) {
  const hexId = useId()
  const hueId = useId()
  /** What the user is typing, or null to show the current color. */
  const [draft, setDraft] = useState<string | null>(null)
  const hasEyedropper = typeof window !== 'undefined' && window.EyeDropper !== undefined

  const invalid = draft !== null && normalizeHex(draft) === null

  function pickAt(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    onChange({
      ...color,
      s: clampUnit((e.clientX - rect.left) / rect.width),
      v: clampUnit(1 - (e.clientY - rect.top) / rect.height),
    })
  }

  function onSquareKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.1 : 0.01
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    onChange({ ...color, s: clampUnit(color.s + move[0]), v: clampUnit(color.v + move[1]) })
  }

  async function pickFromScreen() {
    if (!window.EyeDropper) return
    try {
      const result = await new window.EyeDropper().open()
      const n = normalizeHex(result.sRGBHex)
      if (n) onHex(n)
    } catch {
      // The user cancelled the eyedropper.
    }
  }

  return (
    <div className="cp-picker">
      <div
        className="cp-square"
        style={{ '--hue': `hsl(${color.h} 100% 50%)` } as CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(color.s * 100)}
        aria-valuetext={`Saturation ${Math.round(color.s * 100)}%, brightness ${Math.round(color.v * 100)}%`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pickAt(e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pickAt(e)
        }}
        onKeyDown={onSquareKey}
      >
        <span
          className="cp-thumb"
          style={{ left: `${color.s * 100}%`, top: `${(1 - color.v) * 100}%`, background: hex }}
        />
      </div>

      <div className="field">
        <label htmlFor={hueId}>Hue</label>
        <input
          id={hueId}
          className="cp-hue"
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(color.h)}
          onChange={(e) => onChange({ ...color, h: Number(e.target.value) })}
        />
      </div>

      <div className="cp-hex-row">
        <div className="field">
          <label htmlFor={hexId}>Hex</label>
          <div className="cp-hex-input">
            <span aria-hidden="true">#</span>
            <input
              id={hexId}
              type="text"
              value={draft ?? hex.slice(1)}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={invalid}
              aria-describedby={invalid ? `${hexId}-err` : undefined}
              onChange={(e) => {
                setDraft(e.target.value)
                const n = normalizeHex(e.target.value)
                if (n) onHex(n)
              }}
              onBlur={() => setDraft(null)}
            />
          </div>
        </div>
        {hasEyedropper && (
          <button type="button" className="btn btn-secondary" onClick={pickFromScreen}>
            <Icon name="eyedropper" size={18} />
            Pick from screen
          </button>
        )}
      </div>
      {invalid && (
        <p id={`${hexId}-err`} className="hint hint-error">
          Use 3 or 6 hex digits, like 3B82F6 or FA0.
        </p>
      )}
    </div>
  )
}
