import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { formatBytes } from '../base64/base64'
import { changedRange, diffRows, foldRows, type Line, type Row } from './diff'
import type { Options } from './options'
import { BackgroundDock, CodeEditor, Drawer, Toast, ZoomDock } from './parts'
import { byteLength, formatSvg, parseSvg, readSvgFile, sizedSvg, toDataUrl, type SvgInfo } from './svg'
import { fitTo, usePanZoom, type Size, type View } from './usePanZoom'
import { useToast } from './useToast'
import { EXAMPLE, load, MAX_DRAFT, SAVE_DELAY_MS, stageLook, store, useWindowPaste } from './util'

// The example with a few things changed, to show what a diff looks like.
const EXAMPLE_B = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <!-- A sunny sticker, greener -->
  <circle cx="60" cy="60" r="54" fill="#e6eeff" stroke="#172033" stroke-width="4"/>
  <path d="M60 14v10M60 96v10M14 60h10M96 60h10M27 27l7 7M86 86l7 7M93 27l-7 7M34 86l-7 7"
    stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
  <circle cx="60" cy="60" r="24" fill="#16a34a" stroke="#172033" stroke-width="4"/>
  <circle cx="52" cy="56" r="3" fill="#fff"/>
  <circle cx="68" cy="56" r="3" fill="#fff"/>
  <path d="M49 65q11 11 22 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>
`

const DRAFT_KEY = 'svg-viewer:compare'
// A channel has to move this much (of 255) to count as different, so
// anti-aliasing noise doesn't light up every edge.
const PIXEL_TOLERANCE = 24
// The Difference view is drawn at about this many px on the long side.
const DIFF_PX = 800
const CONTEXT_LINES = 3

// Room Fit leaves around the art for the docks on the board.
const FIT_PAD = 120
const SWIPE_STEP = 2

type Visual = 'side' | 'swipe' | 'diff'
type Side = 'A' | 'B'

const VISUALS: { value: Visual; label: string; icon: IconName }[] = [
  { value: 'swipe', label: 'Swipe', icon: 'swap' },
  { value: 'side', label: 'Side by side', icon: 'image' },
  { value: 'diff', label: 'Difference', icon: 'eyedropper' },
]

const SIDE_TABS: { value: Side; label: string; icon: IconName }[] = [
  { value: 'A', label: 'A', icon: 'code' },
  { value: 'B', label: 'B', icon: 'code' },
]

interface Draft {
  text: string
  name: string | null
  visual: Visual
  raw: boolean
  showCode: boolean
  drawer: Side | null
}

type Parsed = { ok: true; svg: Element; info: SvgInfo; source: string } | { ok: false; error: string } | null
type Good = Parsed & { ok: true }

type PixelDiff = { url: string; share: number; same: boolean } | { error: string }

interface Props {
  a: string
  aName: string | null
  /** A new A; a file name (or null) means a new file, so it replaces the name too. */
  onA: (text: string, fileName?: string | null) => void
  options: Options
  setOptions: (update: (o: Options) => Options) => void
  modeSwitch: ReactNode
}

/** The text, deferred so typing stays smooth, and what it parses to. */
function useParsed(text: string): [string, Parsed] {
  const deferred = useDeferredValue(text)
  const parsed = useMemo((): Parsed => {
    if (deferred.trim() === '') return null
    const result = parseSvg(deferred)
    return result.ok ? { ...result, source: deferred } : result
  }, [deferred])
  return [deferred, parsed]
}

/** Lines to diff: formatted first unless `raw`, so only real changes show. */
function diffLines(text: string, p: Parsed, raw: boolean): string[] {
  const code = !raw && p?.ok ? formatSvg(p.svg) : text
  return code.replace(/\n$/, '').split('\n')
}


/** Draws both SVGs on the same canvas size, centered, and marks the pixels that differ. */
async function pixelDiff(a: Good, b: Good, union: Size): Promise<PixelDiff> {
  const s = Math.min(4, DIFF_PX / Math.max(union.width, union.height))
  const width = Math.max(1, Math.round(union.width * s))
  const height = Math.max(1, Math.round(union.height * s))
  async function pixels(p: Good): Promise<Uint8ClampedArray> {
    const w = Math.max(1, Math.round(p.info.width * s))
    const h = Math.max(1, Math.round(p.info.height * s))
    const img = new Image()
    img.src = toDataUrl(sizedSvg(p.svg, p.info, w, h))
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
    return ctx.getImageData(0, 0, width, height).data
  }
  try {
    const [pa, pb] = await Promise.all([pixels(a), pixels(b)])
    const out = new ImageData(width, height)
    let drawn = 0
    let differ = 0
    for (let i = 0; i < pa.length; i += 4) {
      if (pa[i + 3] === 0 && pb[i + 3] === 0) continue
      drawn++
      const d = Math.max(
        Math.abs(pa[i] - pb[i]),
        Math.abs(pa[i + 1] - pb[i + 1]),
        Math.abs(pa[i + 2] - pb[i + 2]),
        Math.abs(pa[i + 3] - pb[i + 3]),
      )
      if (d > PIXEL_TOLERANCE) {
        differ++
        out.data.set([220, 38, 38, 255], i)
      } else {
        // The same: a faint gray copy of A, for where things are.
        const gray = 0.3 * pa[i] + 0.59 * pa[i + 1] + 0.11 * pa[i + 2]
        out.data.set([gray, gray, gray, pa[i + 3] * 0.3], i)
      }
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.putImageData(out, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('no blob')
    return { url: URL.createObjectURL(blob), share: drawn ? differ / drawn : 0, same: differ === 0 }
  } catch {
    return { error: "Couldn't draw these SVGs to compare their pixels. Browsers block it for some, such as ones with <foreignObject>." }
  }
}

/** A line of the code diff, with the changed part marked on changed rows. */
function DiffCell({ line, other, kind }: { line: Line | null; other: Line | null; kind: Row['kind'] }) {
  if (!line) return <code className="svgv-diff-code svgv-diff-blank" />
  if (kind !== 'change' || !other) return <code className="svgv-diff-code">{line.text || ' '}</code>
  const [from, to] = changedRange(line.text, other.text).a
  return (
    <code className="svgv-diff-code">
      {line.text.slice(0, from)}
      {to > from && <mark>{line.text.slice(from, to)}</mark>}
      {line.text.slice(to)}
    </code>
  )
}

/** One SVG on a stage at the shared zoom and pan. */
function StageImage({ p, view, className = 'svgv-image' }: { p: Good; view: View; className?: string }) {
  const url = useMemo(() => toDataUrl(sizedSvg(p.svg, p.info, p.info.width, p.info.height)), [p])
  return (
    <img
      className={className}
      src={url}
      alt=""
      draggable={false}
      style={{
        width: p.info.width * view.zoom,
        height: p.info.height * view.zoom,
        transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
      }}
    />
  )
}

interface ContenderProps {
  side: Side
  text: string
  name: string | null
  parsed: Parsed
  editing: boolean
  onEdit: () => void
  onFile: (file: File | undefined) => void
  extra?: ReactNode
}

/** One of the two SVGs: a thumbnail, its name and size, and ways to fill it. */
function Contender({ side, text, name, parsed, editing, onEdit, onFile, extra }: ContenderProps) {
  const [drag, setDrag] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumb = useMemo(() => (parsed?.ok ? toDataUrl(sizedSvg(parsed.svg, parsed.info, parsed.info.width, parsed.info.height)) : null), [parsed])
  const status = parsed?.ok
    ? `${px(parsed.info.width)} × ${px(parsed.info.height)} px · ${formatBytes(byteLength(parsed.source))}`
    : parsed
      ? 'The code is broken; fix it in the code panel.'
      : 'Drop, open or paste an SVG'
  return (
    <div
      className={`svgv-contender svgv-contender-${side.toLowerCase()}${drag ? ' svgv-contender-drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        onFile(e.dataTransfer.files[0])
      }}
    >
      <span className="svgv-badge svgv-contender-badge">{side}</span>
      <div className="svgv-contender-thumb svgv-checker" aria-hidden="true">
        {thumb ? <img src={thumb} alt="" /> : <Icon name="vector" size={26} />}
      </div>
      <div className="svgv-contender-text">
        <strong>{text.trim() ? `${name ?? 'untitled'}.svg` : drag ? 'Drop it!' : 'Nothing yet'}</strong>
        <span className={parsed?.ok === false ? 'svgv-contender-error' : 'hint'}>{status}</span>
      </div>
      <div className="svgv-contender-actions">
        <button type="button" className="svgv-action" aria-pressed={editing} onClick={onEdit}>
          <Icon name="code" size={16} />
          Code
        </button>
        <button type="button" className="svgv-action" onClick={() => fileInputRef.current?.click()}>
          <Icon name="upload" size={16} />
          Open
        </button>
        {extra}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".svg,image/svg+xml"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

const px = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function SvgCompare({ a, aName, onA, options, setOptions, modeSwitch }: Props) {
  const [draft] = useState(() =>
    load<Draft>(DRAFT_KEY, { text: '', name: null, visual: 'swipe', raw: false, showCode: false, drawer: null }),
  )
  const [b, setB] = useState(draft.text)
  const [bName, setBName] = useState(draft.name)
  const [visual, setVisual] = useState<Visual>(draft.visual)
  const [raw, setRaw] = useState(draft.raw)
  const [showCode, setShowCode] = useState(draft.showCode)
  const [drawer, setDrawer] = useState<Side | null>(draft.drawer)
  const [swipe, setSwipe] = useState(50)
  const [fittedFor, setFittedFor] = useState('')
  const [pixels, setPixels] = useState<{ key: string; result: PixelDiff } | null>(null)
  const [opened, setOpened] = useState<{ rows: Row[]; at: Set<number> } | null>(null)
  const { toast, show, hide } = useToast()
  const boardRef = useRef<HTMLDivElement>(null)
  const swiping = useRef(false)
  const ids = useId()

  const [da, pa] = useParsed(a)
  const [db, pb] = useParsed(b)
  const sa = pa?.ok ? pa : null
  const sb = pb?.ok ? pb : null

  // Both drawn on one canvas as big as the larger of the two.
  const union = useMemo((): Size | null => {
    const sizes = [sa?.info, sb?.info].filter((i): i is SvgInfo => !!i)
    if (!sizes.length) return null
    return { width: Math.max(...sizes.map((s) => s.width)), height: Math.max(...sizes.map((s) => s.height)) }
  }, [sa, sb])

  const { view, setView, stageSize, dragging, fit, zoomBy, zoomActual, stageRef, stageProps } = usePanZoom(union, FIT_PAD)

  const fitKey = union ? `${union.width}x${union.height}:${visual}` : ''
  if (fitKey !== fittedFor && stageSize.width > 0) {
    setFittedFor(fitKey)
    if (union) setView(fitTo(union, stageSize, FIT_PAD))
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      store(DRAFT_KEY, { text: b.length > MAX_DRAFT ? '' : b, name: bName, visual, raw, showCode, drawer })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [b, bName, visual, raw, showCode, drawer])

  // The Difference image is worked out only when it's on screen.
  const pixelKey = visual === 'diff' && sa && sb && union ? `${sa.source}\u0000${sb.source}` : ''
  useEffect(() => {
    if (!pixelKey || !sa || !sb || !union) return
    let cancelled = false
    let url: string | null = null
    void pixelDiff(sa, sb, union).then((result) => {
      if ('url' in result) url = result.url
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      setPixels({ key: pixelKey, result })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [pixelKey, sa, sb, union])
  const pixelResult = pixels?.key === pixelKey ? pixels.result : null

  const rows = useMemo(
    () => (da.trim() || db.trim() ? diffRows(diffLines(da, pa, raw), diffLines(db, pb, raw)) : []),
    [da, db, pa, pb, raw],
  )
  const pieces = useMemo(() => foldRows(rows, CONTEXT_LINES), [rows])
  const openFolds = opened?.rows === rows ? opened.at : new Set<number>()
  const added = rows.filter((r) => r.right && r.kind !== 'same').length
  const removed = rows.filter((r) => r.left && r.kind !== 'same').length

  function setBText(text: string, name: string | null = bName) {
    setB(text)
    setBName(name)
  }

  function put(side: Side, text: string, name: string | null) {
    if (side === 'A') onA(text, name)
    else setBText(text, name)
  }

  async function openFile(side: Side, file: File | undefined) {
    if (!file) return
    const read = await readSvgFile(file)
    if ('error' in read) show(read.error, { error: true })
    else put(side, read.text, read.name)
  }

  // Pasted SVG goes to the side being edited, else the first empty one, else B.
  useWindowPaste((pasted) => {
    const side: Side = drawer ?? (!a.trim() ? 'A' : 'B')
    if ('text' in pasted) {
      put(side, pasted.text, null)
      show(`Pasted into ${side}`)
    } else void openFile(side, pasted.file)
  })

  function swap() {
    const [oldA, oldAName] = [a, aName]
    onA(b, bName)
    setBText(oldA, oldAName)
    if (a || b) show('Swapped A and B')
  }

  function example() {
    onA(EXAMPLE, 'example')
    setBText(EXAMPLE_B, 'example-greener')
  }

  // ---- Swipe handle: drag it on the art, or use the arrow keys

  function swipeTo(clientX: number) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    setSwipe(Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))))
  }

  function onHandleDown(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    swiping.current = true
  }

  function onHandleKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : SWIPE_STEP
    if (e.key === 'ArrowLeft') setSwipe((v) => Math.max(0, v - step))
    else if (e.key === 'ArrowRight') setSwipe((v) => Math.min(100, v + step))
    else if (e.key === 'Home') setSwipe(0)
    else if (e.key === 'End') setSwipe(100)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  const facts = sa && sb ? factRows(sa, sb) : null
  const colorDiff = sa && sb ? colorChanges(sa.info, sb.info) : null
  const look = stageLook(options.background, options.custom)
  const stageClass = `svgv-stage${look.className}${dragging ? ' svgv-grabbing' : ''}`
  const both = sa && sb && union

  const welcome = (
    <div className="svgv-welcome">
      <div className="svgv-welcome-art svgv-welcome-vs" aria-hidden="true">
        <span>A</span>
        <span>B</span>
      </div>
      <p className="svgv-welcome-title">{a.trim() || b.trim() ? `Now add ${sa ? 'B' : 'A'}` : 'Two SVGs, one face-off'}</p>
      <p className="svgv-welcome-sub">Drop files on the A and B cards above, or paste one anywhere.</p>
      {!a.trim() && !b.trim() && (
        <div className="svgv-welcome-actions">
          <button type="button" className="btn btn-primary" onClick={example}>
            <Icon name="sparkle" size={18} />
            Try an example pair
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="svgv-mode">
      <div className="svgv-topbar">
        {modeSwitch}
        <div className="svgv-topbar-actions">
          <button
            type="button"
            className="svgv-top-btn"
            aria-pressed={drawer !== null}
            onClick={() => setDrawer(drawer ? null : 'A')}
          >
            <Icon name="code" size={18} />
            Code
          </button>
        </div>
      </div>

      <div className="svgv-vs">
        <Contender
          side="A"
          text={a}
          name={aName}
          parsed={pa}
          editing={drawer === 'A'}
          onEdit={() => setDrawer(drawer === 'A' ? null : 'A')}
          onFile={(f) => void openFile('A', f)}
        />
        <button type="button" className="svgv-vs-badge" onClick={swap} aria-label="Swap A and B" title="Swap A and B">
          <span className="svgv-vs-text">VS</span>
          <Icon name="swap" size={20} className="svgv-vs-swap" />
        </button>
        <Contender
          side="B"
          text={b}
          name={bName}
          parsed={pb}
          editing={drawer === 'B'}
          onEdit={() => setDrawer(drawer === 'B' ? null : 'B')}
          onFile={(f) => void openFile('B', f)}
          extra={
            a.trim() && (
              <button type="button" className="svgv-action" onClick={() => setBText(a, aName)} title="Start B as a copy of A">
                <Icon name="copy" size={16} />
                Copy A
              </button>
            )
          }
        />
      </div>

      <div className={drawer ? 'svgv-studio svgv-studio-drawer' : 'svgv-studio'}>
        <div className="svgv-main">
          <div className="svgv-board" ref={boardRef}>
            {visual === 'side' ? (
              <div className="svgv-board-split">
                {[sa, sb].map((p, i) => (
                  <div
                    key={i}
                    ref={stageRef}
                    className={stageClass}
                    style={look.style}
                    tabIndex={p ? 0 : -1}
                    role="img"
                    aria-label={`SVG ${i ? 'B' : 'A'} at ${Math.round(view.zoom * 100)}%`}
                    {...stageProps}
                  >
                    <span className={`svgv-badge svgv-stage-badge${i ? ' svgv-stage-badge-b' : ''}`}>{i ? 'B' : 'A'}</span>
                    {p ? (
                      <StageImage p={p} view={view} />
                    ) : !a.trim() && !b.trim() ? (
                      i === 0 && welcome
                    ) : (
                      <div className="svgv-welcome">
                        <p className="svgv-welcome-sub">
                          {(i ? pb : pa)?.ok === false ? 'Fix the code to see it.' : `Nothing in ${i ? 'B' : 'A'} yet`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                ref={stageRef}
                className={stageClass}
                style={look.style}
                tabIndex={both ? 0 : -1}
                role="img"
                aria-label={visual === 'swipe' ? `B over A, cut at ${swipe}% from the left` : 'Pixels that differ between A and B, in red'}
                {...stageProps}
              >
                {!both ? (
                  welcome
                ) : visual === 'swipe' ? (
                  <>
                    <StageImage p={sa} view={view} />
                    <div className="svgv-swipe-b" style={{ clipPath: `inset(0 0 0 ${swipe}%)` }}>
                      <StageImage p={sb} view={view} />
                    </div>
                  </>
                ) : pixelResult && 'url' in pixelResult ? (
                  <img
                    className="svgv-image svgv-pixelated"
                    src={pixelResult.url}
                    alt=""
                    draggable={false}
                    style={{
                      width: union.width * view.zoom,
                      height: union.height * view.zoom,
                      transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
                    }}
                  />
                ) : (
                  <div className="svgv-welcome">
                    <p className="svgv-welcome-sub">{pixelResult && 'error' in pixelResult ? pixelResult.error : 'Comparing pixels…'}</p>
                  </div>
                )}
              </div>
            )}

            {visual === 'swipe' && both && (
              <div
                className="svgv-swipe-handle"
                style={{ left: `${swipe}%` }}
                role="slider"
                tabIndex={0}
                aria-label="Where B starts"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={swipe}
                aria-valuetext={`${swipe}%`}
                onPointerDown={onHandleDown}
                onPointerMove={(e) => swiping.current && swipeTo(e.clientX)}
                onPointerUp={() => (swiping.current = false)}
                onPointerCancel={() => (swiping.current = false)}
                onKeyDown={onHandleKey}
              >
                <span className="svgv-swipe-knob" aria-hidden="true">
                  <Icon name="chevronLeft" size={14} />
                  <Icon name="chevronRight" size={14} />
                </span>
              </div>
            )}
            {visual === 'swipe' && both && (
              <>
                <span className="svgv-badge svgv-corner svgv-corner-bl">A</span>
                <span className="svgv-badge svgv-corner svgv-corner-br svgv-badge-b">B</span>
              </>
            )}

            <div className="svgv-dock svgv-dock-tl">
              <div className="svgv-dock-group" role="group" aria-label="How to compare">
                {VISUALS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="svgv-dock-tab"
                    aria-pressed={visual === v.value}
                    aria-label={v.label}
                    title={v.label}
                    onClick={() => setVisual(v.value)}
                  >
                    <Icon name={v.icon} size={16} />
                    <span aria-hidden="true">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="svgv-dock svgv-dock-tr">
              <BackgroundDock
                background={options.background}
                custom={options.custom}
                onBackground={(bg) => setOptions((o) => ({ ...o, background: bg }))}
                onCustom={(c) => setOptions((o) => ({ ...o, custom: c }))}
              />
            </div>
            {(sa || sb) && (
              <div className="svgv-dock svgv-dock-bl">
                <ZoomDock view={view} zoomBy={zoomBy} zoomActual={zoomActual} onFit={() => setView(fit())} />
              </div>
            )}

            {visual === 'diff' && pixelResult && 'url' in pixelResult && (
              <p className="svgv-verdict" role="status" data-same={pixelResult.same}>
                {pixelResult.same ? (
                  <>Pixel-perfect twins</>
                ) : (
                  <>
                    <strong>{pixelResult.share < 0.001 ? '<0.1' : (pixelResult.share * 100).toFixed(1)}%</strong> differs
                  </>
                )}
              </p>
            )}
          </div>

          {facts && colorDiff && (
            <ul className="svgv-delta" aria-label="How A and B differ">
              {facts.map((f) => (
                <li key={f.label} data-same={f.a === f.b}>
                  <span className="svgv-delta-label">{f.label}</span>
                  {f.a === f.b ? (
                    <span>{f.a}</span>
                  ) : (
                    <span>
                      {f.a} <span className="svgv-delta-arrow">→</span> <strong>{f.b}</strong>
                    </span>
                  )}
                </li>
              ))}
              <li data-same={colorDiff.onlyA.length + colorDiff.onlyB.length === 0}>
                <span className="svgv-delta-label">Colors</span>
                {colorDiff.onlyA.length + colorDiff.onlyB.length === 0 ? (
                  <span>Same {colorDiff.shared}</span>
                ) : (
                  <span className="svgv-delta-colors">
                    {colorDiff.onlyA.map((c) => (
                      <span key={`a${c}`} className="svgv-delta-color svgv-delta-gone" title={`${c}: only in A`}>
                        <span className="svgv-swatch-color" style={{ background: c }} />
                        {c}
                      </span>
                    ))}
                    {colorDiff.onlyA.length > 0 && colorDiff.onlyB.length > 0 && <span className="svgv-delta-arrow">→</span>}
                    {colorDiff.onlyB.map((c) => (
                      <span key={`b${c}`} className="svgv-delta-color" title={`${c}: only in B`}>
                        <span className="svgv-swatch-color" style={{ background: c }} />
                        <strong>{c}</strong>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            </ul>
          )}

          {rows.length > 0 && (
            <section className="card svgv-panel svgv-changes" aria-labelledby={`${ids}-code`}>
              <button
                type="button"
                className="svgv-disclosure"
                aria-expanded={showCode}
                aria-controls={`${ids}-code-body`}
                onClick={() => setShowCode((v) => !v)}
              >
                <Icon name="chevronRight" size={18} className="svgv-disclosure-icon" />
                <h2 className="svgv-label" id={`${ids}-code`}>
                  Code changes
                </h2>
                <span className="svgv-diff-stats">
                  {added === 0 && removed === 0 ? (
                    <span className="hint">No changes</span>
                  ) : (
                    <>
                      <span className="svgv-diff-plus">+{added}</span>
                      <span className="svgv-diff-minus">−{removed}</span>
                      <span className="hint">lines</span>
                    </>
                  )}
                </span>
              </button>
              {showCode && (
                <div className="svgv-panel" id={`${ids}-code-body`}>
                  <label className="svgv-check">
                    <input type="checkbox" checked={!raw} onChange={(e) => setRaw(!e.target.checked)} />
                    Ignore formatting (compare both formatted)
                  </label>
                  <div className="svgv-diff" role="table" aria-label="Code of A and B, line by line">
                    {pieces.map((piece) =>
                      piece.kind === 'fold' && !openFolds.has(piece.at) ? (
                        <button
                          key={`f${piece.at}`}
                          type="button"
                          className="svgv-diff-fold"
                          onClick={() => setOpened({ rows, at: new Set([...openFolds, piece.at]) })}
                        >
                          <Icon name="chevronDown" size={16} />
                          {piece.rows.length} unchanged lines
                        </button>
                      ) : (
                        piece.rows.map((r, i) => (
                          <div
                            key={`${piece.kind}${'at' in piece ? piece.at : ''}-${i}-${r.left?.no}-${r.right?.no}`}
                            role="row"
                            className={`svgv-diff-row svgv-diff-${r.kind}`}
                          >
                            <span role="cell" className="svgv-diff-no">
                              {r.left?.no}
                            </span>
                            <span role="cell" className="svgv-diff-side svgv-diff-left">
                              <DiffCell line={r.left} other={r.right} kind={r.kind} />
                            </span>
                            <span role="cell" className="svgv-diff-no">
                              {r.right?.no}
                            </span>
                            <span role="cell" className="svgv-diff-side svgv-diff-right">
                              <DiffCell line={r.right} other={r.left} kind={r.kind} />
                            </span>
                          </div>
                        ))
                      ),
                    )}
                  </div>
                  {(pa?.ok === false || pb?.ok === false) && !raw && <p className="hint">Code that doesn’t parse is compared as typed.</p>}
                </div>
              )}
            </section>
          )}
        </div>

        {drawer && (
          <Drawer label="Code of A and B" tabs={SIDE_TABS} tab={drawer} onTab={setDrawer} onClose={() => setDrawer(null)}>
            <CodeEditor
              key={drawer}
              label={drawer === 'A' ? `A · ${aName ?? 'untitled'}.svg` : `B · ${bName ?? 'untitled'}.svg`}
              value={drawer === 'A' ? a : b}
              onChange={(t) => (drawer === 'A' ? onA(t) : setBText(t))}
              onFile={(t, n) => put(drawer, t, n)}
              error={drawer === 'A' ? (pa?.ok === false ? pa.error : null) : pb?.ok === false ? pb.error : null}
              placeholder={`Paste SVG ${drawer} here, or drop an .svg file…`}
              autoFocus
            />
            <p className="hint">A is the same SVG as in Studio. B is kept on this device as its own draft.</p>
          </Drawer>
        )}
      </div>

      <Toast toast={toast} onDone={hide} />
    </div>
  )
}

function factRows(a: Good, b: Good) {
  const row = (label: string, f: (p: Good) => string) => ({ label, a: f(a), b: f(b) })
  return [
    row('Size', (p) => `${px(p.info.width)} × ${px(p.info.height)} px`),
    row('viewBox', (p) => p.info.viewBox ?? 'None'),
    row('Elements', (p) => p.info.elements.toLocaleString()),
    row('File', (p) => formatBytes(byteLength(p.source))),
  ]
}

function colorChanges(a: SvgInfo, b: SvgInfo) {
  const inA = new Set(a.colors.map((c) => c.value))
  const inB = new Set(b.colors.map((c) => c.value))
  return {
    onlyA: [...inA].filter((c) => !inB.has(c)),
    onlyB: [...inB].filter((c) => !inA.has(c)),
    shared: [...inA].filter((c) => inB.has(c)).length,
  }
}
