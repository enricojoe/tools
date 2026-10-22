import { Icon } from '../../components/Icon'
import { MAX_SAVED } from './color'

interface SavedColorsProps {
  saved: string[]
  current: string
  onSave: () => void
  onLoad: (hex: string) => void
  onRemove: (hex: string) => void
}

export function SavedColors({ saved, current, onSave, onLoad, onRemove }: SavedColorsProps) {
  const alreadySaved = saved.includes(current)
  const full = saved.length >= MAX_SAVED

  return (
    <section className="card cp-saved" aria-labelledby="cp-saved-title">
      <div className="cp-saved-head">
        <h2 id="cp-saved-title" className="section-title">
          Saved colors
        </h2>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={alreadySaved || full}>
          <Icon name="plus" size={18} />
          {alreadySaved ? 'Saved' : 'Save this color'}
        </button>
      </div>

      {full && !alreadySaved && <p className="hint">You've saved {MAX_SAVED} colors. Remove one to make room.</p>}

      {saved.length === 0 ? (
        <p className="empty">Nothing saved yet. Pick a color you like and save it here.</p>
      ) : (
        <ul className="cp-saved-list">
          {saved.map((hex) => (
            <li key={hex} className="cp-saved-item">
              <button
                type="button"
                className="cp-swatch"
                style={{ background: hex }}
                aria-label={`Use saved color ${hex}`}
                aria-pressed={hex === current}
                title={hex}
                onClick={() => onLoad(hex)}
              />
              <button
                type="button"
                className="cp-remove"
                aria-label={`Remove saved color ${hex}`}
                onClick={() => onRemove(hex)}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
