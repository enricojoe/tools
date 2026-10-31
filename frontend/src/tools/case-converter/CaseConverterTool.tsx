import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { CASES, type CaseGroup } from './convert'
import './CaseConverterTool.css'

const GROUPS: { value: CaseGroup; label: string }[] = [
  { value: 'text', label: 'For writing' },
  { value: 'code', label: 'For code' },
]

// Shown, dimmed, until there's text of your own.
const SAMPLE = 'The quick brown fox jumps over the lazy dog'

const DRAFT_KEY = 'case-converter:draft'
// Drafts past this size aren't saved, so one huge paste can't fill storage.
const MAX_DRAFT = 200_000
const SAVE_DELAY_MS = 300

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeDraft(text: string): void {
  try {
    if (text === '' || text.length > MAX_DRAFT) localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, text)
  } catch {
    // Storage unavailable or full: the draft just won't survive a reload.
  }
}

export default function CaseConverterTool() {
  const [text, setText] = useState(loadDraft)
  // The text as typed or pasted, kept while "Use this" swaps in conversions
  // so it can be brought back; null once there's nothing to go back to.
  const [original, setOriginal] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const ids = useId()

  // Converting long text twelve ways on every keystroke would make typing
  // lag; React updates the results once it has a spare moment instead.
  const deferred = useDeferredValue(text)
  const empty = deferred.trim() === ''
  const results = useMemo(
    () => CASES.map((c) => ({ ...c, output: c.convert(empty ? SAMPLE : deferred) })),
    [deferred, empty],
  )

  useEffect(() => {
    const id = window.setTimeout(() => storeDraft(deferred), SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [deferred])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  async function handleCopy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyFailed(false)
      setCopiedId(id)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  function handleEdit(value: string) {
    setText(value)
    setOriginal(null)
  }

  function handleUse(value: string) {
    setOriginal((o) => o ?? text)
    setText(value)
    textareaRef.current?.focus()
  }

  function handleRestore() {
    if (original === null) return
    setText(original)
    setOriginal(null)
    textareaRef.current?.focus()
  }

  const copiedLabel = CASES.find((c) => c.id === copiedId)?.label

  return (
    <div className="cc-tool">
      <section className="card cc-editor">
        <div className="cc-editor-head">
          <label htmlFor={`${ids}-text`} className="cc-label">
            Your text
          </label>
          <div className="cc-actions">
            {original !== null && (
              <button type="button" className="btn btn-secondary" onClick={handleRestore}>
                <Icon name="reset" size={18} />
                Original case
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => handleEdit('')} disabled={text === ''}>
              <Icon name="trash" size={18} />
              Clear
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          id={`${ids}-text`}
          className="cc-textarea"
          value={text}
          onChange={(e) => handleEdit(e.target.value)}
          placeholder="Type or paste something, then grab it in any case…"
          spellCheck={false}
        />
        {copyFailed && (
          <p className="error" role="alert">
            Couldn't copy automatically. Select the text and copy it by hand.
          </p>
        )}
        <p className="hint">
          Code cases convert each line on its own, so a list of names stays a list. Converted right here in your
          browser; the text is kept on this device as a draft.
        </p>
        <p className="sr-only" role="status">
          {copiedLabel ? `Copied ${copiedLabel}` : ''}
        </p>
      </section>

      <div className="cc-side">
        {GROUPS.map((g) => (
          <section key={g.value} className="card cc-group" aria-labelledby={`${ids}-${g.value}`}>
            <h2 className="cc-label" id={`${ids}-${g.value}`}>
              {g.label}
            </h2>
            <ul className="cc-list">
              {results
                .filter((r) => r.group === g.value)
                .map((r) => (
                  <li key={r.id} className="cc-row">
                    <div className="cc-row-text">
                      <span className="cc-name">{r.label}</span>
                      <span className={empty ? 'cc-output cc-output-sample' : 'cc-output'}>{r.output || '—'}</span>
                    </div>
                    <div className="cc-row-actions">
                      <button
                        type="button"
                        className="cc-action"
                        onClick={() => handleCopy(r.id, r.output)}
                        disabled={empty || r.output === ''}
                        aria-label={`Copy ${r.label}`}
                      >
                        <Icon name={copiedId === r.id ? 'check' : 'copy'} size={16} />
                        {copiedId === r.id ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        className="cc-action"
                        onClick={() => handleUse(r.output)}
                        disabled={empty || r.output === deferred}
                        aria-label={`Use ${r.label} as your text`}
                      >
                        Use this
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
