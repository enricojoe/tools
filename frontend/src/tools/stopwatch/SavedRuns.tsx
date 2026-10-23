import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { StopwatchSession } from '../../api/stopwatch'
import { formatElapsed } from './format'

interface SavedRunsProps {
  /** Null until the first load finishes. */
  runs: StopwatchSession[] | null
  /** Why the list couldn't be loaded, or null. */
  error: string | null
  onRetry: () => void
  /** Resolves to an error message, or null on success. */
  onDelete: (id: string) => Promise<string | null>
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function SavedRuns({ runs, error, onRetry, onDelete }: SavedRunsProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleteError(await onDelete(id))
  }

  return (
    <section className="card sw-runs-card" aria-labelledby="runs-title">
      <h2 id="runs-title" className="section-title">
        Saved runs
      </h2>

      {error !== null && (
        <div className="error" role="alert">
          <p>Couldn't load saved runs ({error}), but the stopwatch works just fine.</p>
          <button type="button" className="btn btn-secondary retry-btn" onClick={onRetry}>
            <Icon name="reset" size={16} />
            Retry
          </button>
        </div>
      )}
      {deleteError !== null && (
        <p className="error" role="alert">
          Couldn't delete that run: {deleteError}
        </p>
      )}

      {runs === null && error === null && (
        <p className="muted" role="status">
          Loading saved runs…
        </p>
      )}

      {runs !== null &&
        (runs.length === 0 ? (
          <p className="empty">Nothing saved yet. Pause the stopwatch and press Save.</p>
        ) : (
          <ul className="sw-run-list">
            {runs.map((r) => (
              <li key={r.id} className="sw-run">
                <span className="sw-run-label">{r.label || 'Untitled run'}</span>
                <span className="sw-run-total">{formatElapsed(r.elapsedMs)}</span>
                <span className="sw-run-meta">
                  {r.laps.length} {r.laps.length === 1 ? 'lap' : 'laps'} · {formatWhen(r.completedAt)}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary sw-run-delete"
                  onClick={() => void handleDelete(r.id)}
                  aria-label={`Delete ${r.label || 'untitled run'} from ${formatWhen(r.completedAt)}`}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
