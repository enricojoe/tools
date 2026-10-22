import { useId, useState } from 'react'
import { LIMITS, type Settings } from './phases'

type NumberKey = keyof typeof LIMITS

const FIELDS: { key: NumberKey; label: string }[] = [
  { key: 'focusMinutes', label: 'Focus (min)' },
  { key: 'shortBreakMinutes', label: 'Short break (min)' },
  { key: 'longBreakMinutes', label: 'Long break (min)' },
  { key: 'longBreakEvery', label: 'Long break every (rounds)' },
]

interface NumberFieldProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
}

/** Keeps what's being typed as text so the field can be cleared; only valid numbers are committed. */
function NumberField({ id, label, value, min, max, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)

  function change(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 3)
    setDraft(digits)
    const n = Number(digits)
    if (digits !== '' && n >= min && n <= max) onCommit(n)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft ?? String(value)}
        aria-describedby={`${id}-range`}
        onChange={(e) => change(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => setDraft(null)}
      />
      <span id={`${id}-range`} className="hint">
        {min}–{max}
      </span>
    </div>
  )
}

interface PomodoroSettingsProps {
  settings: Settings
  onChange: (settings: Settings) => void
}

export function PomodoroSettings({ settings, onChange }: PomodoroSettingsProps) {
  const ids = useId()

  return (
    <details className="card pomo-settings">
      <summary>Settings</summary>
      <div className="pomo-settings-body">
        <div className="pomo-fields">
          {FIELDS.map(({ key, label }) => (
            <NumberField
              key={key}
              id={`${ids}-${key}`}
              label={label}
              value={settings[key]}
              min={LIMITS[key].min}
              max={LIMITS[key].max}
              onCommit={(value) => onChange({ ...settings, [key]: value })}
            />
          ))}
        </div>
        <label className="pomo-check">
          <input
            type="checkbox"
            checked={settings.autoStart}
            onChange={(e) => onChange({ ...settings, autoStart: e.target.checked })}
          />
          Start the next phase automatically
        </label>
        <p className="hint">Changes apply to phases you haven't started yet. They're saved in this browser.</p>
      </div>
    </details>
  )
}
