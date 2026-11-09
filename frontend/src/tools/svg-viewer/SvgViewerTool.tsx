import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Icon } from '../../components/Icon'
import { formatBytes } from '../base64/base64'
import { byteLength, formatSvg, minifySvg, parseSvg, sizedSvg, toDataUrl, type SvgInfo } from './svg'
import './SvgViewerTool.css'

const EXAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <!-- A sunny sticker -->
  <circle cx="60" cy="60" r="54" fill="#e6eeff" stroke="#172033" stroke-width="4"/>
  <path d="M60 14v10M60 96v10M14 60h10M96 60h10M27 27l7 7M86 86l7 7M93 27l-7 7M34 86l-7 7"
    stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>
  <circle cx="60" cy="60" r="24" fill="#1d4ed8" stroke="#172033" stroke-width="4"/>
  <circle cx="52" cy="56" r="3" fill="#fff"/>
  <circle cx="68" cy="56" r="3" fill="#fff"/>
  <path d="M51 66q9 8 18 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>
`

const DRAFT_KEY = 'svg-viewer:draft'
const OPTIONS_KEY = 'svg-viewer:options'
// Drafts past this size aren't saved, so one huge paste can't fill storage.
const MAX_DRAFT = 500_000
const SAVE_DELAY_MS = 300
const MAX_FILE = 5 * 1024 * 1024
// Browsers refuse canvases much bigger than this.
const MAX_PNG = 8192
const MIN_ZOOM = 0.05
const MAX_ZOOM = 64
// Fit doesn't blow a tiny icon up past this.
const MAX_FIT = 16
const STEP = 1.25
const PAN_STEP = 40
const MAX_COLORS = 24
const MAX_TAGS = 8

type Background = 'checker' | 'white' | 'black' | 'custom'

const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: 'checker', label: 'Checker' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'custom', label: 'Color' },
]

const SCALES = [1, 2, 4] as const

interface Options {
  background: Background
  custom: string
  transparentPng: boolean
}

const DEFAULT_OPTIONS: Options = { background: 'checker', custom: '#fde68a', transparentPng: true }

interface Draft {
  text: string
  name: string | null
}

/** An SVG that parsed, with the code it came from. */
interface Shown {
  ok: true
  source: string
  svg: Element
  info: SvgInfo
}

/** Zoom, and the image's offset from the middle of the stage in px. */
interface View {
  zoom: number
  x: number
  y: number
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable or full: the choice just won't survive a reload.
  }
}

function download(data: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Give the browser a moment to start the download before letting go.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Zooms by `factor` keeping the point `at` (relative to the stage middle) still. */
function zoomView(v: View, factor: number, at = { x: 0, y: 0 }): View {
  const zoom = clampZoom(v.zoom * factor)
  const k = zoom / v.zoom
  return { zoom, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }
}

/** The zoom that fits the whole image in the stage, centered. */
function fitTo(info: SvgInfo, stage: { width: number; height: number }): View {
  const zoom = Math.min((stage.width - 48) / info.width, (stage.height - 48) / info.height, MAX_FIT)
  return { zoom: clampZoom(zoom), x: 0, y: 0 }
}

const px = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function sizeSource(info: SvgInfo): string {
  if (info.sizeFrom === 'viewBox') return 'From the viewBox (no width or height set).'
  if (info.sizeFrom === 'default') return 'No usable width, height or viewBox, so browsers draw it at 300 × 150.'
  const set = [info.widthAttr && `width="${info.widthAttr}"`, info.heightAttr && `height="${info.heightAttr}"`]
  return `From ${set.filter(Boolean).join(' ')}.`
}

export default function SvgViewerTool() {
  const [draft] = useState(() => load<Draft>(DRAFT_KEY, { text: '', name: null }))
  const [text, setText] = useState(draft.text)
  const [name, setName] = useState(draft.name)
  const [options, setOptions] = useState(() => load<Options>(OPTIONS_KEY, DEFAULT_OPTIONS))
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [fittedFor, setFittedFor] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileDrag, setFileDrag] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [tidyNote, setTidyNote] = useState<string | null>(null)
  const [scale, setScale] = useState<number | 'custom'>(2)
  const [customWidth, setCustomWidth] = useState('1024')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ids = useId()

  const deferred = useDeferredValue(text)
  const current = useMemo((): Shown | { ok: false; error: string } | null => {
    if (deferred.trim() === '') return null
    const parsed = parseSvg(deferred)
    return parsed.ok ? { ...parsed, source: deferred } : parsed
  }, [deferred])

  // While the code is broken mid-edit, keep showing the last version that worked.
  const [lastGood, setLastGood] = useState<Shown | null>(null)
  if (current?.ok && current !== lastGood) setLastGood(current)
  if (current === null && lastGood !== null) setLastGood(null)
  const shown = current === null ? null : current.ok ? current : lastGood
  const stale = current !== null && !current.ok
  const info = shown?.info ?? null

  // Sized and with a viewBox, so it scales crisply instead of being cropped.
  const previewUrl = useMemo(
    () => (shown ? toDataUrl(sizedSvg(shown.svg, shown.info, shown.info.width, shown.info.height)) : null),
    [shown],
  )

  // The code to copy or download: as typed, unless it needed fixing to show.
  const code = useMemo(() => {
    if (!shown) return ''
    return shown.info.fixes.length ? new XMLSerializer().serializeToString(shown.svg) + '\n' : shown.source
  }, [shown])

  // A new size (a new SVG, mostly) starts fitted to the stage. Keyed on the
  // size alone, so editing colors or shapes doesn't reset the zoom.
  const fitKey = info ? `${info.width}x${info.height}` : ''
  if (fitKey !== fittedFor && stageSize.width > 0) {
    setFittedFor(fitKey)
    if (info) setView(fitTo(info, stageSize))
  }

  function fitView(): View {
    return info ? fitTo(info, stageSize) : { zoom: 1, x: 0, y: 0 }
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // A passive React wheel handler can't stop the page scrolling, so listen directly.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = stage!.getBoundingClientRect()
      const at = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 }
      setView((v) => zoomView(v, Math.exp(-e.deltaY * 0.002), at))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      store(DRAFT_KEY, { text: deferred.length > MAX_DRAFT ? '' : deferred, name })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [deferred, name])

  useEffect(() => store(OPTIONS_KEY, options), [options])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  function setOption<K extends keyof Options>(key: K, value: Options[K]) {
    setOptions((o) => ({ ...o, [key]: value }))
  }

  function replaceText(value: string) {
    setText(value)
    setTidyNote(null)
    setExportError(null)
  }

  function handleClear() {
    replaceText('')
    setName(null)
    setFileError(null)
    textareaRef.current?.focus()
  }

  function handleExample() {
    replaceText(EXAMPLE)
    setName('example')
    textareaRef.current?.focus()
  }

  async function handleFile(picked: File | undefined) {
    if (!picked) return
    if (picked.size > MAX_FILE) {
      setFileError(`“${picked.name}” is ${formatBytes(picked.size)}; files up to ${formatBytes(MAX_FILE)} work here.`)
      return
    }
    const svgLike = picked.type === 'image/svg+xml' || /\.svg$/i.test(picked.name) || !picked.type.startsWith('image/')
    if (!svgLike) {
      setFileError(`“${picked.name}” is a ${picked.type.replace('image/', '').toUpperCase()} image, not an SVG.`)
      return
    }
    try {
      replaceText(await picked.text())
      setName(picked.name.replace(/\.[^.]+$/, '') || 'image')
      setFileError(null)
    } catch {
      setFileError(`Couldn't read “${picked.name}”.`)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setFileDrag(false)
    void handleFile(e.dataTransfer.files[0])
  }

  // A copied .svg file has no text; read the file instead.
  function handlePaste(e: ClipboardEvent) {
    if (e.clipboardData.types.includes('text/plain')) return
    const pasted = e.clipboardData.files[0]
    if (!pasted) return
    e.preventDefault()
    void handleFile(pasted)
  }

  function handleTidy(minify: boolean) {
    if (!current?.ok) return
    const before = byteLength(current.source)
    const next = minify ? minifySvg(current.svg) : formatSvg(current.svg)
    const after = byteLength(next)
    replaceText(next)
    const change = before > 0 ? Math.round((after / before - 1) * 100) : 0
    setTidyNote(
      `${minify ? 'Minified' : 'Formatted'}: ${formatBytes(before)} → ${formatBytes(after)}` +
        (change === 0 ? '' : ` (${change > 0 ? '+' : '−'}${Math.abs(change)}%)`),
    )
  }

  async function handleCopy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyFailed(false)
      setCopied(key)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  function zoomBy(factor: number) {
    setView((v) => zoomView(v, factor))
  }

  function zoomActual() {
    setView((v) => zoomView(v, 1 / v.zoom))
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !shown) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y }
    setDragging(true)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    setView((v) => ({ ...v, x: start.x + e.clientX - start.px, y: start.y + e.clientY - start.py }))
  }

  function handlePointerUp() {
    dragStart.current = null
    setDragging(false)
  }

  function handleStageKey(e: KeyboardEvent) {
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
    }
    if (e.key === '+' || e.key === '=') zoomBy(STEP)
    else if (e.key === '-') zoomBy(1 / STEP)
    else if (e.key === '0') setView(fitView())
    else if (e.key === '1') zoomActual()
    else if (pan[e.key]) {
      const [dx, dy] = pan[e.key]
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    } else return
    e.preventDefault()
  }

  const pngSize = useMemo(() => {
    if (!info) return null
    const width = scale === 'custom' ? Math.round(Number(customWidth)) : Math.round(info.width * scale)
    if (!Number.isFinite(width) || width < 1) return null
    return { width, height: Math.max(1, Math.round((width * info.height) / info.width)) }
  }, [info, scale, customWidth])
  const pngTooBig = pngSize !== null && (pngSize.width > MAX_PNG || pngSize.height > MAX_PNG)

  const solidColor = options.background === 'black' ? '#000000' : options.background === 'custom' ? options.custom : '#ffffff'

  async function handlePng() {
    if (!shown || !pngSize || pngTooBig) return
    setExporting(true)
    setExportError(null)
    try {
      const img = new Image()
      img.src = toDataUrl(sizedSvg(shown.svg, shown.info, pngSize.width, pngSize.height))
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = pngSize.width
      canvas.height = pngSize.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      if (!options.transparentPng) {
        ctx.fillStyle = solidColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('no blob')
      download(blob, `${name ?? 'image'}.png`, 'image/png')
    } catch {
      setExportError("Couldn't turn this SVG into a PNG. Browsers block it for some SVGs, such as ones with <foreignObject>.")
    } finally {
      setExporting(false)
    }
  }

  const dataUrl = useMemo(() => (shown ? toDataUrl(minifySvg(shown.svg)) : ''), [shown])
  const stageBackground =
    options.background === 'checker' ? undefined : { background: options.background === 'custom' ? options.custom : solidColor }

  function copyButton(value: string, key: string, label: string) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => handleCopy(value, key)}>
        <Icon name={copied === key ? 'check' : 'copy'} size={18} />
        {copied === key ? 'Copied!' : label}
      </button>
    )
  }

  return (
    <div className="svgv-tool">
      <section className="card svgv-panel">
        <div className="svgv-head">
          <h2 className="svgv-label">SVG code</h2>
          <div className="svgv-actions">
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload" size={18} />
              File
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClear} disabled={text === ''}>
              <Icon name="trash" size={18} />
              Clear
            </button>
          </div>
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
          onDrop={handleDrop}
        >
          <label htmlFor={`${ids}-code`} className="sr-only">
            SVG code
          </label>
          <textarea
            ref={textareaRef}
            id={`${ids}-code`}
            className="svgv-textarea"
            value={text}
            onChange={(e) => replaceText(e.target.value)}
            onPaste={handlePaste}
            placeholder={'Paste SVG code here, or drop / paste an .svg file…\n\n<svg xmlns="http://www.w3.org/2000/svg" …>'}
            spellCheck={false}
            wrap="off"
          />
          {fileDrag && (
            <span className="svgv-drop-note" aria-hidden="true">
              Drop to open the SVG
            </span>
          )}
        </div>

        {fileError && (
          <p className="error" role="alert">
            {fileError}
          </p>
        )}

        <div className="svgv-head">
          <div className="svgv-actions">
            <button type="button" className="svgv-action" onClick={() => handleTidy(false)} disabled={!current?.ok}>
              Format
            </button>
            <button type="button" className="svgv-action" onClick={() => handleTidy(true)} disabled={!current?.ok}>
              Minify
            </button>
          </div>
          {tidyNote && (
            <span className="hint" role="status">
              {tidyNote}
            </span>
          )}
        </div>

        <p className="hint">
          The preview is drawn as an image, so scripts in the SVG never run and nothing is fetched. Everything stays in
          your browser; the code is kept on this device as a draft.
        </p>
      </section>

      <div className="svgv-side">
        <section className="card svgv-panel" aria-labelledby={`${ids}-preview`}>
          <div className="svgv-head">
            <h2 className="svgv-label" id={`${ids}-preview`}>
              Preview
            </h2>
            <div className="svgv-chips" role="group" aria-label="Background">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  className="svgv-chip"
                  aria-pressed={options.background === b.value}
                  onClick={() => setOption('background', b.value)}
                >
                  <span className={`svgv-dot svgv-dot-${b.value}`} style={b.value === 'custom' ? { background: options.custom } : undefined} />
                  {b.label}
                </button>
              ))}
              {options.background === 'custom' && (
                <input
                  type="color"
                  className="svgv-color"
                  value={options.custom}
                  onChange={(e) => setOption('custom', e.target.value)}
                  aria-label="Background color"
                />
              )}
            </div>
          </div>

          <div
            ref={stageRef}
            className={`svgv-stage${options.background === 'checker' ? ' svgv-checker' : ''}${dragging ? ' svgv-grabbing' : ''}`}
            style={stageBackground}
            tabIndex={shown ? 0 : -1}
            role="img"
            aria-label={shown ? `SVG preview at ${Math.round(view.zoom * 100)}%` : 'SVG preview'}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleStageKey}
          >
            {previewUrl && info ? (
              <img
                className="svgv-image"
                src={previewUrl}
                alt=""
                draggable={false}
                style={{
                  width: info.width * view.zoom,
                  height: info.height * view.zoom,
                  transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
                }}
              />
            ) : (
              <div className="svgv-empty">
                <p>{stale ? 'Fix the code to see it here.' : 'Your SVG shows up here.'}</p>
                {!stale && (
                  <button type="button" className="svgv-action" onClick={handleExample}>
                    <Icon name="sparkle" size={16} />
                    Try an example
                  </button>
                )}
              </div>
            )}
          </div>

          {shown && (
            <div className="svgv-head">
              <div className="svgv-actions svgv-zoom" role="group" aria-label="Zoom">
                <button type="button" className="btn btn-secondary svgv-icon-btn" onClick={() => zoomBy(1 / STEP)} aria-label="Zoom out" title="Zoom out (-)">
                  <Icon name="zoomOut" size={18} />
                </button>
                <button type="button" className="svgv-zoom-value" onClick={zoomActual} title="Actual size (1)">
                  {Math.round(view.zoom * 100)}%
                </button>
                <button type="button" className="btn btn-secondary svgv-icon-btn" onClick={() => zoomBy(STEP)} aria-label="Zoom in" title="Zoom in (+)">
                  <Icon name="zoomIn" size={18} />
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setView(fitView())} title="Fit (0)">
                  <Icon name="fit" size={18} />
                  Fit
                </button>
              </div>
              <span className="hint">Scroll to zoom, drag to move.</span>
            </div>
          )}

          {stale && (
            <p className="error" role="alert">
              {current.error}
              {shown && ' Showing the last version that worked.'}
            </p>
          )}
        </section>

        {info && shown && (
          <section className="card svgv-panel" aria-labelledby={`${ids}-details`}>
            <h2 className="svgv-label" id={`${ids}-details`}>
              Details
            </h2>
            <dl className="svgv-facts">
              <div>
                <dt>Size</dt>
                <dd>
                  <strong>
                    {px(info.width)} × {px(info.height)} px
                  </strong>
                  <span className="hint">{sizeSource(info)}</span>
                </dd>
              </div>
              <div>
                <dt>viewBox</dt>
                <dd>{info.viewBox ? <code>{info.viewBox}</code> : <span className="hint">None</span>}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>
                  {formatBytes(byteLength(shown.source))} · {shown.source.split('\n').length.toLocaleString()} lines
                </dd>
              </div>
              <div>
                <dt>Elements</dt>
                <dd>
                  <span>{info.elements.toLocaleString()}</span>
                  <span className="svgv-tags">
                    {info.tags.slice(0, MAX_TAGS).map(([tag, count]) => (
                      <code key={tag}>
                        {tag} ×{count}
                      </code>
                    ))}
                    {info.tags.length > MAX_TAGS && <span className="hint">+{info.tags.length - MAX_TAGS} more</span>}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Colors</dt>
                <dd>
                  {info.colors.length === 0 ? (
                    <span className="hint">None set (shapes without a fill are black).</span>
                  ) : (
                    <span className="svgv-swatches">
                      {info.colors.slice(0, MAX_COLORS).map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          className="svgv-swatch"
                          onClick={() => handleCopy(c.value, `color:${c.value}`)}
                          title={`${c.value} · used ${c.count}× · click to copy`}
                        >
                          <span className="svgv-swatch-color" style={{ background: c.value }} />
                          {copied === `color:${c.value}` ? 'Copied!' : c.value}
                        </button>
                      ))}
                      {info.colors.length > MAX_COLORS && (
                        <span className="hint">+{info.colors.length - MAX_COLORS} more</span>
                      )}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {(info.fixes.length > 0 || info.warnings.length > 0) && (
              <ul className="svgv-notes">
                {info.fixes.map((f) => (
                  <li key={f} className="svgv-note-fix">
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
                {info.warnings.map((w) => (
                  <li key={w}>
                    <Icon name="flag" size={16} />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {info && shown && (
          <section className="card svgv-panel" aria-labelledby={`${ids}-export`}>
            <h2 className="svgv-label" id={`${ids}-export`}>
              Save or copy
            </h2>

            <div className="svgv-export">
              <div className="svgv-chips" role="group" aria-label="PNG size">
                {SCALES.map((s) => (
                  <button key={s} type="button" className="svgv-chip" aria-pressed={scale === s} onClick={() => setScale(s)}>
                    {s}×
                  </button>
                ))}
                <button type="button" className="svgv-chip" aria-pressed={scale === 'custom'} onClick={() => setScale('custom')}>
                  Width
                </button>
                {scale === 'custom' && (
                  <input
                    type="number"
                    className="svgv-width"
                    min={1}
                    max={MAX_PNG}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    aria-label="PNG width in px"
                  />
                )}
              </div>
              <label className="svgv-check">
                <input
                  type="checkbox"
                  checked={options.transparentPng}
                  onChange={(e) => setOption('transparentPng', e.target.checked)}
                />
                Transparent background
                {!options.transparentPng && (
                  <span className="svgv-swatch-color" style={{ background: solidColor }} title={`Filled with ${solidColor}`} />
                )}
              </label>
              <p className="hint">
                {pngSize ? `${pngSize.width.toLocaleString()} × ${pngSize.height.toLocaleString()} px` : 'Enter a width.'}
                {pngTooBig && ` · too big, ${MAX_PNG.toLocaleString()} px per side at most`}
                {!options.transparentPng && ' · filled with the preview color (white for checker)'}
              </p>
            </div>

            <div className="svgv-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePng}
                disabled={!pngSize || pngTooBig || exporting}
              >
                <Icon name="image" size={18} />
                {exporting ? 'Making PNG…' : 'Download PNG'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => download(code, `${name ?? 'image'}.svg`, 'image/svg+xml')}
              >
                <Icon name="download" size={18} />
                SVG
              </button>
            </div>
            <div className="svgv-actions">
              {copyButton(code, 'code', 'Copy code')}
              {copyButton(dataUrl, 'url', 'Copy data URL')}
              {copyButton(`background-image: url("${dataUrl}");`, 'css', 'Copy as CSS')}
            </div>
            <p className="hint">
              The data URL is the minified SVG, percent-encoded only where needed, for <code>src</code> or CSS{' '}
              <code>url()</code>.
            </p>

            {exportError && (
              <p className="error" role="alert">
                {exportError}
              </p>
            )}
            {copyFailed && (
              <p className="error" role="alert">
                Couldn't copy automatically. Select the code and copy it by hand.
              </p>
            )}
            <p className="sr-only" role="status">
              {copied ? 'Copied' : ''}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
