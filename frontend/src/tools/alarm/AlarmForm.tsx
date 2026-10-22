import { useId, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { unlockAudio } from '../shared/alert'
import { isValidTime, WEEKDAYS } from './alarmTime'
import type { NewAlarm } from './useAlarms'

interface AlarmFormProps {
  onAdd: (alarm: NewAlarm) => void
}

export function AlarmForm({ onAdd }: AlarmFormProps) {
  const [time, setTime] = useState('07:00')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState<number[]>([])
  const ids = useId()

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValidTime(time)) return
    unlockAudio()
    onAdd({ time, label: label.trim(), days })
    setLabel('')
  }

  return (
    <form className="card form alarm-form" onSubmit={handleSubmit}>
      <h2 className="section-title">New alarm</h2>
      <div className="row">
        <div className="field">
          <label htmlFor={`${ids}-time`}>Time (server clock)</label>
          <input
            id={`${ids}-time`}
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-label`}>Label (optional)</label>
          <input
            id={`${ids}-label`}
            type="text"
            maxLength={60}
            placeholder="Wake up!"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>

      <fieldset className="field day-picker">
        <legend>Repeat</legend>
        <div className="day-buttons">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              className="day-btn"
              aria-pressed={days.includes(d.value)}
              aria-label={d.long}
              title={d.long}
              onClick={() => toggleDay(d.value)}
            >
              {d.letter}
            </button>
          ))}
        </div>
        <p className="hint">
          {days.length === 0
            ? 'No days picked: rings once, then switches itself off.'
            : 'Rings on the days you picked.'}
        </p>
      </fieldset>

      <button type="submit" className="btn btn-primary">
        <Icon name="plus" size={18} />
        Add alarm
      </button>
    </form>
  )
}
