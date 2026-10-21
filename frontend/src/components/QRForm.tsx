import { useState, type FormEvent } from 'react'
import type { ErrorLevel, QRRequest } from '../api/qr'

export const MAX_CONTENT_BYTES = 2048

const SIZES = [128, 256, 512, 1024]

const LEVELS: { value: ErrorLevel; label: string }[] = [
  { value: 'L', label: 'Low (7%)' },
  { value: 'M', label: 'Medium (15%)' },
  { value: 'Q', label: 'Quartile (25%)' },
  { value: 'H', label: 'High (30%)' },
]

const encoder = new TextEncoder()

interface QRFormProps {
  loading: boolean
  onSubmit: (request: QRRequest) => void
}

export function QRForm({ loading, onSubmit }: QRFormProps) {
  const [content, setContent] = useState('')
  const [size, setSize] = useState(256)
  const [level, setLevel] = useState<ErrorLevel>('M')

  const bytes = encoder.encode(content).length
  const tooLong = bytes > MAX_CONTENT_BYTES
  const canSubmit = content.trim() !== '' && !tooLong && !loading

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (canSubmit) onSubmit({ content, size, level })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="content">Text or URL</label>
        <textarea
          id="content"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-invalid={tooLong}
          aria-describedby="content-hint"
          placeholder="https://example.com"
        />
        <p id="content-hint" className={tooLong ? 'hint hint-error' : 'hint'}>
          {bytes} / {MAX_CONTENT_BYTES} bytes
          {tooLong && ' - content is too long'}
        </p>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="size">Size</label>
          <select
            id="size"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} x {s} px
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="level">Error correction</label>
          <select
            id="level"
            value={level}
            onChange={(e) => setLevel(e.target.value as ErrorLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        {loading ? 'Generating...' : 'Generate'}
      </button>
    </form>
  )
}
