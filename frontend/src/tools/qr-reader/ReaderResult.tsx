import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'

interface ReaderResultProps {
  content: string
  onReset: () => void
}

/** Only http(s) links get an "Open link" button; other schemes (javascript:, data:) never do. */
function isWebUrl(text: string): boolean {
  try {
    const { protocol } = new URL(text.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function ReaderResult({ content, onReset }: ReaderResultProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopyFailed(false)
      setCopied(true)
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <section className="card reader-result" aria-label="Scan result">
      <h2 className="result-title">Got it! Here's what it says</h2>
      <pre className="result-text">{content}</pre>

      {copyFailed && (
        <p className="error" role="alert">
          Couldn't copy automatically. Select the text and copy it by hand.
        </p>
      )}

      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={handleCopy}>
          <Icon name="copy" size={18} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {isWebUrl(content) && (
          <a
            className="btn btn-secondary"
            href={content.trim()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external" size={18} />
            Open link
          </a>
        )}
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          <Icon name="scan" size={18} />
          Scan another
        </button>
      </div>
      <p className="sr-only" role="status">
        {copied ? 'Copied to clipboard' : ''}
      </p>
    </section>
  )
}
