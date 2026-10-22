import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { CameraReader } from './CameraReader'
import { ReaderResult } from './ReaderResult'
import { UploadReader } from './UploadReader'
import './QRReaderTool.css'

type Mode = 'upload' | 'camera'

const MODES: { value: Mode; label: string; icon: IconName }[] = [
  { value: 'upload', label: 'Upload', icon: 'upload' },
  { value: 'camera', label: 'Camera', icon: 'camera' },
]

export default function QRReaderTool() {
  const [mode, setMode] = useState<Mode>('upload')
  const [content, setContent] = useState<string | null>(null)
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({
    upload: null,
    camera: null,
  })
  const baseId = useId()

  // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern.
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = mode === 'upload' ? 'camera' : 'upload'
    setMode(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="reader-tool">
      <div
        className="mode-switch"
        role="tablist"
        aria-label="How to scan"
        onKeyDown={handleKeyDown}
      >
        {MODES.map((m) => (
          <button
            key={m.value}
            ref={(el) => {
              tabRefs.current[m.value] = el
            }}
            type="button"
            role="tab"
            id={`${baseId}-${m.value}-tab`}
            aria-selected={mode === m.value}
            aria-controls={`${baseId}-panel`}
            tabIndex={mode === m.value ? 0 : -1}
            className="mode-tab"
            onClick={() => setMode(m.value)}
          >
            <Icon name={m.icon} size={18} />
            {m.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-${mode}-tab`}
        className="reader-panel"
      >
        {content !== null ? (
          <ReaderResult content={content} onReset={() => setContent(null)} />
        ) : mode === 'upload' ? (
          <UploadReader onResult={setContent} />
        ) : (
          <CameraReader onResult={setContent} />
        )}
      </div>
    </div>
  )
}
