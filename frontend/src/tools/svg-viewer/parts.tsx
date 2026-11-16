// Pieces Studio and A vs B share: the docks floating on the artboard, the
// code editor, the side drawer and the toast.

import { useEffect, useId, useRef, useState, type ClipboardEvent, type ReactNode } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { readSvgFile } from './svg'
import { ZOOM_STEP, type View } from './usePanZoom'
import type { ToastState } from './useToast'
import { BACKGROUNDS, type Background } from './util'

interface BackgroundDockProps {
  background: Background
  custom: string
  onBackground: (b: Background) => void
  onCustom: (color: string) => void
}

/** Background swatches as round dots, for a dock on the board. */
export function BackgroundDock({ background, custom, onBackground, onCustom }: BackgroundDockProps) {
  return (
    <div className="svgv-dock-group" role="group" aria-label="Background">
      {BACKGROUNDS.map((b) => (
        <button
          key={b.value}
          type="button"
          className={`svgv-bg-dot svgv-dot-${b.value}`}
          style={b.value === 'custom' ? { background: custom } : undefined}
          aria-pressed={background === b.value}
          aria-label={`${b.label} background`}
          title={`${b.label} background`}
          onClick={() => onBackground(b.value)}
        />
      ))}
      {background === 'custom' && (
        <input
          type="color"
          className="svgv-bg-picker"
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          aria-label="Background color"
          title="Pick the background color"
        />
      )}
    </div>
  )
}

interface ZoomDockProps {
  view: View
  zoomBy: (factor: number) => void
  zoomActual: () => void
  onFit: () => void
}

export function ZoomDock({ view, zoomBy, zoomActual, onFit }: ZoomDockProps) {
  return (
    <div className="svgv-dock-group" role="group" aria-label="Zoom">
      <button type="button" className="svgv-dock-btn" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom out" title="Zoom out (-)">
        <Icon name="zoomOut" size={18} />
      </button>
      <button type="button" className="svgv-dock-zoom" onClick={zoomActual} title="Actual size (1)">
        {Math.round(view.zoom * 100)}%
      </button>
      <button type="button" className="svgv-dock-btn" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in" title="Zoom in (+)">
        <Icon name="zoomIn" size={18} />
      </button>
      <button type="button" className="svgv-dock-btn" onClick={onFit} aria-label="Fit" title="Fit (0)">
        <Icon name="fit" size={18} />
      </button>
    </div>
  )
}

interface CodeEditorProps {
  label: string
  value: string
  onChange: (value: string) => void
  onFile: (text: string, name: string) => void
  /** The parse error to show under the code, if any. */
  error?: string | null
  placeholder?: string
  autoFocus?: boolean
}

/** SVG code: type, paste, or drop / paste an .svg file onto it. */
export function CodeEditor({ label, value, onChange, onFile, error, placeholder, autoFocus }: CodeEditorProps) {
  const [fileDrag, setFileDrag] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  async function handleFile(picked: File | undefined) {
    if (!picked) return
    const read = await readSvgFile(picked)
    if ('error' in read) {
      setFileError(read.error)
      return
    }
    onFile(read.text, read.name)
    setFileError(null)
  }

  // A copied .svg file has no text; read the file instead.
  function handlePaste(e: ClipboardEvent) {
    if (e.clipboardData.types.includes('text/plain')) return
    const pasted = e.clipboardData.files[0]
    if (!pasted) return
    e.preventDefault()
    void handleFile(pasted)
  }

  return (
    <div className="svgv-editor">
      <div className="svgv-editor-bar">
        <label htmlFor={`${id}-code`} className="svgv-editor-label">
          {label}
        </label>
        <button type="button" className="svgv-action" onClick={() => fileInputRef.current?.click()}>
          <Icon name="upload" size={16} />
          File
        </button>
        <button
          type="button"
          className="svgv-action"
          onClick={() => {
            onChange('')
            setFileError(null)
          }}
          disabled={value === ''}
        >
          <Icon name="trash" size={16} />
          Clear
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".svg,image/svg+xml"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div
        className={fileDrag ? 'svgv-drop svgv-drop-active' : 'svgv-drop'}
        onDragOver={(e) => {
          e.preventDefault()
          setFileDrag(true)
        }}
        onDragLeave={() => setFileDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setFileDrag(false)
          void handleFile(e.dataTransfer.files[0])
        }}
      >
        <textarea
          id={`${id}-code`}
          className="svgv-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder ?? 'Paste SVG code here, or drop an .svg file…'}
          spellCheck={false}
          wrap="off"
          // The drawer opens because the user asked to edit; put them right in.
          autoFocus={autoFocus}
        />
        {fileDrag && (
          <span className="svgv-drop-note" aria-hidden="true">
            Drop to open
          </span>
        )}
      </div>
      {(fileError || error) && (
        <p className="error" role="alert">
          {fileError ?? error}
        </p>
      )}
    </div>
  )
}

interface DrawerTab<T extends string> {
  value: T
  label: string
  icon: IconName
}

interface DrawerProps<T extends string> {
  label: string
  tabs: DrawerTab<T>[]
  tab: T
  onTab: (tab: T) => void
  onClose: () => void
  children: ReactNode
}

/** The panel beside the board for code and React output, with tabs. */
export function Drawer<T extends string>({ label, tabs, tab, onTab, onClose, children }: DrawerProps<T>) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)

  // Under the board on narrow screens, so bring it into view when it opens.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1100px)').matches) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <aside ref={ref} className="card svgv-drawer" aria-label={label}>
      <div className="svgv-drawer-head">
        <div className="svgv-tabs" role="tablist" aria-label={label}>
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`${id}-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`${id}-panel`}
              className="svgv-tab"
              onClick={() => onTab(t.value)}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="svgv-dock-btn" onClick={onClose} aria-label="Close panel" title="Close">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="svgv-drawer-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {children}
      </div>
    </aside>
  )
}

/** The sticker toast at the bottom of the screen. */
export function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  return (
    <div className="svgv-toast-slot" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={toast.error ? 'svgv-toast svgv-toast-error' : 'svgv-toast'}>
          <Icon name={toast.error ? 'flag' : 'check'} size={18} />
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="svgv-toast-action"
              onClick={() => {
                toast.action!.run()
                onDone()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
