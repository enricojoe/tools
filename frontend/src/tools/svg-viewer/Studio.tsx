import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { formatBytes } from '../base64/base64'
import { componentName, svgToJsx, validName } from './jsx'
import type { Options, StudioTab } from './options'
import { BackgroundDock, CodeEditor, Drawer, Toast, ZoomDock } from './parts'
import {
  byteLength,
  formatSvg,
  minifySvg,
  normalizeColor,
  parseSvg,
  readSvgFile,
  recolorSvg,
  sizedSvg,
  toDataUrl,
  type SvgInfo,
} from './svg'
import { fitTo, usePanZoom } from './usePanZoom'
import { useToast } from './useToast'
import { copyText, download, EXAMPLE, solidColor, stageLook, useWindowPaste } from './util'

// Browsers refuse canvases much bigger than this.
const MAX_PNG = 8192
const SCALES = [1, 2, 4] as const
const MAX_POTS = 24
// Room Fit leaves around the art for the docks on the board.
const FIT_PAD = 120
// Hovering a pot repaints that color in this, so you can spot where it's used.
const SPOT = '#ff2bd6'
const SPOT_ALT = '#00e5ff'
// Past this, repainting on every hover gets sluggish; the spotlight is skipped.
const MAX_SPOT_SOURCE = 200_000

const DRAWER_TABS: { value: StudioTab; label: string; icon: 'code' | 'atom' }[] = [
  { value: 'code', label: 'SVG code', icon: 'code' },
  { value: 'react', label: 'React', icon: 'atom' },
]

/** An SVG that parsed, with the code it came from. */
interface Shown {
  ok: true
  source: string
  svg: Element
  info: SvgInfo
}

interface StudioProps {
  text: string
  name: string | null
  /** An edit to the code; the file name stays. */
  onEdit: (text: string) => void
  /** New code from a file, the example or a paste. */
  onOpen: (text: string, name: string | null) => void
  options: Options
  setOptions: (update: (o: Options) => Options) => void
  modeSwitch: ReactNode
}

const px = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function sizeSource(info: SvgInfo): string {
  if (info.sizeFrom === 'viewBox') return 'From the viewBox (no width or height set).'
  if (info.sizeFrom === 'default') return 'No usable width, height or viewBox, so browsers draw it at 300 × 150.'
  const set = [info.widthAttr && `width="${info.widthAttr}"`, info.heightAttr && `height="${info.heightAttr}"`]
  return `From ${set.filter(Boolean).join(' ')}.`
}

/** Whether CSS takes this as a color (named, hex, rgb(), hsl(), currentColor…). */
function isColor(value: string): boolean {
  return value.trim() !== '' && CSS.supports('color', value.trim())
}

/** A value for `<input type="color">`, which only takes #rrggbb. */
function hexForPicker(value: string): string {
  const v = normalizeColor(value)
  return /^#[0-9a-f]{6}$/.test(v) ? v : /^#[0-9a-f]{8}$/.test(v) ? v.slice(0, 7) : '#000000'
}

/** The SVG drawn at its own size as a data URL for an <img>. */
function previewOf(svg: Element, info: SvgInfo): string {
  return toDataUrl(sizedSvg(svg, info, info.width, info.height))
}

export default function Studio({ text, name, onEdit, onOpen, options, setOptions, modeSwitch }: StudioProps) {
  const [fittedFor, setFittedFor] = useState('')
  const [boardDrag, setBoardDrag] = useState(false)
  const [mixing, setMixing] = useState<string | null>(null)
  const [mixTo, setMixTo] = useState<string | null>(null)
  const [spotted, setSpotted] = useState<string | null>(null)
  const [pngOpen, setPngOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [jsxName, setJsxName] = useState<{ for: string | null; value: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const { toast, show, hide } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pngRef = useRef<HTMLDivElement>(null)
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

  const { view, setView, stageSize, dragging, fit, zoomBy, zoomActual, stageRef, stageProps } = usePanZoom(info, FIT_PAD)

  // A new size (a new SVG, mostly) starts fitted. Keyed on the size alone, so
  // recoloring or editing shapes doesn't reset the zoom.
  const fitKey = info ? `${info.width}x${info.height}` : ''
  if (fitKey !== fittedFor && stageSize.width > 0) {
    setFittedFor(fitKey)
    if (info) setView(fitTo(info, stageSize, FIT_PAD))
  }

  // ---- Paint pots: the mixer, and the spotlight on hover

  const colors = info?.colors ?? []
  const mixFrom = colors.find((c) => c.value === mixing) ?? null
  const toColor = mixTo ?? mixFrom?.value ?? ''
  const toValid = isColor(toColor)
  const toSame = mixFrom !== null && normalizeColor(toColor) === mixFrom.value

  // What the board shows: the SVG, or a try-out of the mixer or spotlight.
  const previewUrl = useMemo(() => {
    if (!shown) return null
    let swap: [string, string] | null = null
    if (mixFrom && toValid && !toSame) swap = [mixFrom.value, toColor.trim()]
    else if (!mixFrom && spotted && shown.source.length <= MAX_SPOT_SOURCE) swap = [spotted, spotted === SPOT ? SPOT_ALT : SPOT]
    if (!swap) return previewOf(shown.svg, shown.info)
    const tried = parseSvg(recolorSvg(shown.svg, swap[0], swap[1]).code)
    return tried.ok ? previewOf(tried.svg, shown.info) : previewOf(shown.svg, shown.info)
  }, [shown, mixFrom, toColor, toValid, toSame, spotted])

  function openMixer(value: string | null) {
    setMixing(value)
    setMixTo(null)
    setSpotted(null)
  }

  function applyMix() {
    if (!current?.ok || !mixFrom || !toValid || toSame) return
    const to = toColor.trim()
    const result = recolorSvg(current.svg, mixFrom.value, to)
    const before = text
    onEdit(result.code)
    openMixer(null)
    show(`Repainted ${result.count === 1 ? '1 spot' : `${result.count} spots`}: ${mixFrom.value} → ${to}`, {
      action: { label: 'Undo', run: () => onEdit(before) },
    })
  }

  // ---- Opening files

  async function openPicked(file: File | undefined) {
    if (!file) return
    const read = await readSvgFile(file)
    if ('error' in read) show(read.error, { error: true })
    else onOpen(read.text, read.name)
  }

  useWindowPaste((pasted) => {
    if ('text' in pasted) {
      onOpen(pasted.text, null)
      show('Pasted SVG opened')
    } else void openPicked(pasted.file)
  })

  // ---- Drawer, PNG popover, keys

  function setDrawer(open: boolean, tab: StudioTab = options.drawerTab) {
    setOptions((o) => ({ ...o, drawer: open, drawerTab: tab }))
  }

  function toggleDrawer(tab: StudioTab) {
    setDrawer(!(options.drawer && options.drawerTab === tab), tab)
  }

  useEffect(() => {
    if (!pngOpen) return
    function close(e: PointerEvent) {
      if (!pngRef.current?.contains(e.target as Node)) setPngOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [pngOpen])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setPngOpen(false)
      setMixing(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- Copy and export

  async function copy(value: string, what: string) {
    if (await copyText(value)) show(`Copied ${what}`)
    else show("Couldn't copy automatically. Open the code panel and copy it by hand.", { error: true })
  }

  // The code to copy or download: as typed, unless it needed fixing to show.
  const code = useMemo(() => {
    if (!shown) return ''
    return shown.info.fixes.length ? new XMLSerializer().serializeToString(shown.svg) + '\n' : shown.source
  }, [shown])
  const dataUrl = useMemo(() => (shown ? toDataUrl(minifySvg(shown.svg)) : ''), [shown])

  const pngSize = useMemo(() => {
    if (!info) return null
    const width = options.scale === 'custom' ? Math.round(Number(options.pngWidth)) : Math.round(info.width * options.scale)
    if (!Number.isFinite(width) || width < 1) return null
    return { width, height: Math.max(1, Math.round((width * info.height) / info.width)) }
  }, [info, options.scale, options.pngWidth])
  const pngTooBig = pngSize !== null && (pngSize.width > MAX_PNG || pngSize.height > MAX_PNG)
  const solid = solidColor(options.background, options.custom)

  async function downloadPng() {
    if (!shown || !pngSize || pngTooBig) return
    setExporting(true)
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
        ctx.fillStyle = solid
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('no blob')
      download(blob, `${name ?? 'image'}.png`, 'image/png')
      show(`PNG saved, ${pngSize.width} × ${pngSize.height} px`)
    } catch {
      show("Couldn't make a PNG. Browsers block it for some SVGs, such as ones with <foreignObject>.", { error: true })
    } finally {
      setExporting(false)
    }
  }

  function tidy(minify: boolean) {
    if (!current?.ok) return
    const before = byteLength(current.source)
    const next = minify ? minifySvg(current.svg) : formatSvg(current.svg)
    const after = byteLength(next)
    const old = text
    onEdit(next)
    show(`${minify ? 'Minified' : 'Formatted'}: ${formatBytes(before)} → ${formatBytes(after)}`, {
      action: { label: 'Undo', run: () => onEdit(old) },
    })
  }

  // ---- React

  // A name typed for this file; a new file starts from its own name again.
  const jsxNameValue = jsxName?.for === name ? jsxName.value : componentName(name)
  const jsxFinal = validName(jsxNameValue) ? jsxNameValue : componentName(jsxNameValue)
  const jsx = useMemo(
    () => (shown && options.drawer && options.drawerTab === 'react' ? svgToJsx(shown.svg, shown.info, { ...options.jsx, name: jsxNameValue }) : null),
    [shown, options.drawer, options.drawerTab, options.jsx, jsxNameValue],
  )
  const jsxExt = options.jsx.typescript ? 'tsx' : 'jsx'

  function setJsx<K extends keyof Options['jsx']>(key: K, value: Options['jsx'][K]) {
    setOptions((o) => ({ ...o, jsx: { ...o.jsx, [key]: value } }))
  }

  const look = stageLook(options.background, options.custom)
  const notes = info ? [...info.fixes.map((t) => ({ t, fix: true })), ...info.warnings.map((t) => ({ t, fix: false }))] : []

  return (
    <div className="svgv-mode">
      <div className="svgv-topbar">
        {modeSwitch}
        <div className="svgv-topbar-actions">
          <button type="button" className="svgv-top-btn" onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={18} />
            Open
          </button>
          <button
            type="button"
            className="svgv-top-btn"
            aria-pressed={options.drawer && options.drawerTab === 'code'}
            onClick={() => toggleDrawer('code')}
          >
            <Icon name="code" size={18} />
            Code
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".svg,image/svg+xml"
        onChange={(e) => {
          void openPicked(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <div className={options.drawer ? 'svgv-studio svgv-studio-drawer' : 'svgv-studio'}>
        <div className="svgv-main">
          <div
            className={`svgv-board${boardDrag ? ' svgv-board-drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setBoardDrag(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setBoardDrag(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setBoardDrag(false)
              void openPicked(e.dataTransfer.files[0])
            }}
          >
            {shown && <span className="svgv-tape">{name ?? 'untitled'}.svg</span>}

            <div
              ref={stageRef}
              className={`svgv-stage${look.className}${dragging ? ' svgv-grabbing' : ''}`}
              style={look.style}
              tabIndex={shown ? 0 : -1}
              role="img"
              aria-label={shown ? `SVG preview at ${Math.round(view.zoom * 100)}%` : 'SVG preview'}
              {...stageProps}
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
                <div className="svgv-welcome">
                  <div className="svgv-welcome-art" aria-hidden="true">
                    <Icon name="vector" size={44} />
                  </div>
                  <p className="svgv-welcome-title">{stale ? 'That code doesn’t draw yet' : 'Drop an SVG on the board'}</p>
                  <p className="svgv-welcome-sub">
                    {stale ? 'Fix it in the code panel.' : 'or paste one anywhere on the page (⌘V / Ctrl+V)'}
                  </p>
                  <div className="svgv-welcome-actions">
                    <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload" size={18} />
                      Open a file
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setDrawer(true, 'code')}>
                      <Icon name="code" size={18} />
                      Paste code
                    </button>
                    <button type="button" className="svgv-action" onClick={() => onOpen(EXAMPLE, 'example')}>
                      <Icon name="sparkle" size={16} />
                      Try an example
                    </button>
                  </div>
                </div>
              )}
            </div>

            {shown && (
              <div className="svgv-dock svgv-dock-tl">
                <ZoomDock view={view} zoomBy={zoomBy} zoomActual={zoomActual} onFit={() => setView(fit())} />
              </div>
            )}
            <div className="svgv-dock svgv-dock-tr">
              <BackgroundDock
                background={options.background}
                custom={options.custom}
                onBackground={(b) => setOptions((o) => ({ ...o, background: b }))}
                onCustom={(c) => setOptions((o) => ({ ...o, custom: c }))}
              />
            </div>

            {stale && shown && (
              <div className="svgv-board-alert" role="alert">
                <Icon name="flag" size={16} />
                <span>{current.error} Showing the last version that worked.</span>
                {!options.drawer && (
                  <button type="button" className="svgv-action" onClick={() => setDrawer(true, 'code')}>
                    Fix it
                  </button>
                )}
              </div>
            )}

            {boardDrag && (
              <div className="svgv-board-drop" aria-hidden="true">
                <span>Drop it!</span>
              </div>
            )}

            {mixFrom && (
              <div className="svgv-mixer" role="dialog" aria-labelledby={`${ids}-mixer`}>
                <div className="svgv-mixer-head">
                  <p className="svgv-mixer-title" id={`${ids}-mixer`}>
                    Repaint <code>{mixFrom.value}</code>
                  </p>
                  <button type="button" className="svgv-dock-btn" onClick={() => openMixer(null)} aria-label="Cancel" title="Cancel (Esc)">
                    <Icon name="close" size={18} />
                  </button>
                </div>
                <div className="svgv-mixer-swatches">
                  <span className="svgv-mixer-from" style={{ background: mixFrom.value }} title={mixFrom.value} />
                  <Icon name="arrow" size={20} />
                  <label className="svgv-mixer-to" style={{ background: toValid ? toColor : 'transparent' }} title="Pick the new color">
                    <input
                      type="color"
                      value={hexForPicker(toColor)}
                      onChange={(e) => setMixTo(e.target.value)}
                      aria-label={`New color for ${mixFrom.value}`}
                    />
                  </label>
                  <div className="svgv-mixer-fields">
                    <input
                      className="svgv-field svgv-mixer-text"
                      value={toColor}
                      onChange={(e) => setMixTo(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyMix()}
                      spellCheck={false}
                      aria-label="New color as text"
                      aria-invalid={!toValid}
                    />
                    <button
                      type="button"
                      className="svgv-action"
                      aria-pressed={toColor === 'currentColor'}
                      onClick={() => setMixTo('currentColor')}
                      title="Takes the text color where the SVG is placed, handy for icons"
                    >
                      currentColor
                    </button>
                  </div>
                </div>
                {!toValid && <p className="svgv-mixer-error">“{toColor}” isn’t a color. Try #16a34a, teal or rgb(…).</p>}
                <div className="svgv-mixer-actions">
                  <button type="button" className="btn btn-primary" onClick={applyMix} disabled={!current?.ok || !toValid || toSame}>
                    <Icon name="palette" size={18} />
                    Repaint {mixFrom.count === 1 ? '1 spot' : `${mixFrom.count} spots`}
                  </button>
                  <button type="button" className="svgv-action" onClick={() => copy(mixFrom.value, mixFrom.value)}>
                    <Icon name="copy" size={16} />
                    Copy {mixFrom.value}
                  </button>
                </div>
                <p className="svgv-mixer-hint">
                  {toSame ? 'Pick a new color; the board tries it out live.' : 'Trying it out on the board; nothing changes until you repaint.'}
                </p>
              </div>
            )}

            {shown && (
              <div className="svgv-tray">
                {colors.length === 0 ? (
                  <p className="svgv-tray-hint">No colors set; shapes without a fill draw black.</p>
                ) : (
                  <>
                    <div className="svgv-pots" role="group" aria-label="Colors in this SVG">
                      {colors.slice(0, MAX_POTS).map((c, i) => (
                        <button
                          key={c.value}
                          type="button"
                          className="svgv-pot"
                          style={{ '--pot': c.value, '--tilt': `${(i % 3) - 1}deg` } as CSSProperties}
                          aria-pressed={c.value === mixFrom?.value}
                          aria-label={`${c.value}, used ${c.count} ${c.count === 1 ? 'time' : 'times'}. Repaint it.`}
                          title={`${c.value} · used ${c.count}×`}
                          onClick={() => openMixer(c.value === mixFrom?.value ? null : c.value)}
                          onPointerEnter={() => setSpotted(c.value)}
                          onPointerLeave={() => setSpotted(null)}
                          onFocus={() => setSpotted(c.value)}
                          onBlur={() => setSpotted(null)}
                        >
                          <span className="svgv-pot-paint" />
                          {c.count > 1 && <span className="svgv-pot-count">{c.count}</span>}
                          <span className="svgv-pot-label">{c.value}</span>
                        </button>
                      ))}
                      {colors.length > MAX_POTS && <span className="svgv-tray-hint">+{colors.length - MAX_POTS}</span>}
                    </div>
                    <p className="svgv-tray-hint">
                      <Icon name="palette" size={14} /> Hover a pot to spot it, click to repaint it
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {info && shown && (
            <div className="svgv-info">
              <span className="svgv-info-chip" title={sizeSource(info)}>
                <strong>
                  {px(info.width)} × {px(info.height)}
                </strong>{' '}
                px
              </span>
              <span className="svgv-info-chip" title="viewBox">
                <Icon name="fit" size={14} />
                {info.viewBox ?? 'no viewBox'}
              </span>
              <span className="svgv-info-chip" title={info.tags.map(([t, n]) => `${t} ×${n}`).join(', ')}>
                <strong>{info.elements.toLocaleString()}</strong> elements
              </span>
              <span className="svgv-info-chip">
                <strong>{formatBytes(byteLength(shown.source))}</strong> · {shown.source.split('\n').length.toLocaleString()} lines
              </span>
              {notes.length > 0 && (
                <button
                  type="button"
                  className="svgv-info-chip svgv-info-notes"
                  aria-expanded={notesOpen}
                  aria-controls={`${ids}-notes`}
                  onClick={() => setNotesOpen((v) => !v)}
                >
                  <Icon name="flag" size={14} />
                  {notes.length === 1 ? '1 note' : `${notes.length} notes`}
                </button>
              )}
            </div>
          )}
          {notesOpen && notes.length > 0 && (
            <ul className="svgv-notes" id={`${ids}-notes`}>
              {notes.map((n) => (
                <li key={n.t} className={n.fix ? 'svgv-note-fix' : undefined}>
                  <Icon name={n.fix ? 'check' : 'flag'} size={16} />
                  {n.t}
                </li>
              ))}
            </ul>
          )}

          {shown && (
            <section className="svgv-takeaway" aria-labelledby={`${ids}-takeaway`}>
              <h2 className="svgv-takeaway-title" id={`${ids}-takeaway`}>
                Take it with you
              </h2>
              <div className="svgv-stickers">
                <div className="svgv-split" ref={pngRef}>
                  <button
                    type="button"
                    className="svgv-sticker svgv-sticker-main"
                    onClick={downloadPng}
                    disabled={!pngSize || pngTooBig || exporting}
                  >
                    <Icon name="image" size={18} />
                    {exporting ? 'Making…' : `PNG ${options.scale === 'custom' ? `${options.pngWidth}px` : `${options.scale}×`}`}
                  </button>
                  <button
                    type="button"
                    className="svgv-sticker svgv-sticker-main svgv-split-caret"
                    aria-expanded={pngOpen}
                    aria-controls={`${ids}-png`}
                    aria-label="PNG options"
                    onClick={() => setPngOpen((v) => !v)}
                  >
                    <Icon name="chevronDown" size={16} />
                  </button>
                  {pngOpen && (
                    <div className="svgv-popover" id={`${ids}-png`} role="dialog" aria-label="PNG options">
                      <div className="svgv-chips" role="group" aria-label="PNG size">
                        {SCALES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="svgv-chip"
                            aria-pressed={options.scale === s}
                            onClick={() => setOptions((o) => ({ ...o, scale: s }))}
                          >
                            {s}×
                          </button>
                        ))}
                        <button
                          type="button"
                          className="svgv-chip"
                          aria-pressed={options.scale === 'custom'}
                          onClick={() => setOptions((o) => ({ ...o, scale: 'custom' }))}
                        >
                          Width
                        </button>
                      </div>
                      {options.scale === 'custom' && (
                        <label className="svgv-check">
                          <input
                            type="number"
                            className="svgv-field svgv-field-num"
                            min={1}
                            max={MAX_PNG}
                            value={options.pngWidth}
                            onChange={(e) => setOptions((o) => ({ ...o, pngWidth: e.target.value }))}
                          />
                          px wide
                        </label>
                      )}
                      <label className="svgv-check">
                        <input
                          type="checkbox"
                          checked={options.transparentPng}
                          onChange={(e) => setOptions((o) => ({ ...o, transparentPng: e.target.checked }))}
                        />
                        Transparent
                        {!options.transparentPng && <span className="svgv-swatch-color" style={{ background: solid }} title={`Filled with ${solid}`} />}
                      </label>
                      <p className="hint">
                        {pngSize ? `${pngSize.width.toLocaleString()} × ${pngSize.height.toLocaleString()} px` : 'Enter a width.'}
                        {pngTooBig && ` · too big, ${MAX_PNG.toLocaleString()} px per side at most`}
                        {!options.transparentPng && ' · on the board color (white for checker)'}
                      </p>
                    </div>
                  )}
                </div>
                <button type="button" className="svgv-sticker" onClick={() => download(code, `${name ?? 'image'}.svg`, 'image/svg+xml')}>
                  <Icon name="download" size={18} />
                  SVG
                </button>
                <button type="button" className="svgv-sticker" onClick={() => copy(code, 'the code')}>
                  <Icon name="copy" size={18} />
                  Copy code
                </button>
                <button type="button" className="svgv-sticker" onClick={() => copy(dataUrl, 'the data URL')} title="Minified, percent-encoded, for src or url()">
                  <Icon name="copy" size={18} />
                  Data URL
                </button>
                <button type="button" className="svgv-sticker" onClick={() => copy(`background-image: url("${dataUrl}");`, 'the CSS')}>
                  <Icon name="copy" size={18} />
                  CSS
                </button>
                <button
                  type="button"
                  className="svgv-sticker svgv-sticker-react"
                  aria-pressed={options.drawer && options.drawerTab === 'react'}
                  onClick={() => toggleDrawer('react')}
                >
                  <Icon name="atom" size={18} />
                  React
                </button>
              </div>
              <p className="hint">
                Drawn as an image, so scripts in the SVG never run and nothing is fetched. Everything stays in your
                browser; the code is kept on this device.
              </p>
            </section>
          )}
        </div>

        {options.drawer && (
          <Drawer
            label="SVG code and React"
            tabs={DRAWER_TABS}
            tab={options.drawerTab}
            onTab={(t) => setDrawer(true, t)}
            onClose={() => setDrawer(false)}
          >
            {options.drawerTab === 'code' ? (
              <>
                <CodeEditor
                  label={name ? `${name}.svg` : 'SVG code'}
                  value={text}
                  onChange={onEdit}
                  onFile={(t, n) => onOpen(t, n)}
                  error={stale ? current.error : null}
                  placeholder={'Paste SVG code here, or drop an .svg file…\n\n<svg xmlns="http://www.w3.org/2000/svg" …>'}
                  autoFocus={!text}
                />
                <div className="svgv-actions">
                  <button type="button" className="svgv-action" onClick={() => tidy(false)} disabled={!current?.ok}>
                    Format
                  </button>
                  <button type="button" className="svgv-action" onClick={() => tidy(true)} disabled={!current?.ok}>
                    Minify
                  </button>
                </div>
              </>
            ) : !jsx ? (
              <p className="hint">Open an SVG first; its React version shows up here.</p>
            ) : (
              <>
                <div className="svgv-chips" role="group" aria-label="JSX output">
                  <button type="button" className="svgv-chip" aria-pressed={options.jsx.component} onClick={() => setJsx('component', true)}>
                    Component
                  </button>
                  <button type="button" className="svgv-chip" aria-pressed={!options.jsx.component} onClick={() => setJsx('component', false)}>
                    JSX only
                  </button>
                </div>
                {options.jsx.component && (
                  <label className="svgv-name">
                    Name
                    <input
                      className="svgv-field"
                      value={jsxNameValue}
                      onChange={(e) => setJsxName({ for: name, value: e.target.value })}
                      spellCheck={false}
                      aria-invalid={!validName(jsxNameValue)}
                    />
                  </label>
                )}
                {options.jsx.component && !validName(jsxNameValue) && (
                  <p className="hint">
                    Components start with a capital letter; using <code>{jsxFinal}</code>.
                  </p>
                )}
                <div className="svgv-jsx-options">
                  {options.jsx.component && (
                    <label className="svgv-check">
                      <input type="checkbox" checked={options.jsx.typescript} onChange={(e) => setJsx('typescript', e.target.checked)} />
                      TypeScript
                    </label>
                  )}
                  {options.jsx.component && (
                    <label className="svgv-check">
                      <input type="checkbox" checked={options.jsx.spreadProps} onChange={(e) => setJsx('spreadProps', e.target.checked)} />
                      Pass props through
                    </label>
                  )}
                  <label className="svgv-check">
                    <input type="checkbox" checked={options.jsx.dropSize} onChange={(e) => setJsx('dropSize', e.target.checked)} />
                    Size with CSS
                  </label>
                </div>
                <pre className="svgv-code" tabIndex={0} aria-label="JSX code">
                  <code>{jsx.code}</code>
                </pre>
                <div className="svgv-actions">
                  <button type="button" className="btn btn-primary" onClick={() => copy(jsx.code, 'the JSX')}>
                    <Icon name="copy" size={18} />
                    Copy JSX
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => download(jsx.code, `${options.jsx.component ? jsxFinal : (name ?? 'image')}.${jsxExt}`, 'text/plain')}
                  >
                    <Icon name="download" size={18} />.{jsxExt}
                  </button>
                </div>
                {jsx.notes.length > 0 && (
                  <ul className="svgv-notes">
                    {jsx.notes.map((n) => (
                      <li key={n}>
                        <Icon name="flag" size={16} />
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Drawer>
        )}
      </div>

      <Toast toast={toast} onDone={hide} />
    </div>
  )
}
