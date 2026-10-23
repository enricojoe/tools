import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Icon } from '../../components/Icon'
import { SwatchRow } from './SwatchRow'
import { loadImageData, mainColors, pixelHex, validateImage } from './image'

/** Pixels shown across the loupe, and how big each one is drawn. */
const LOUPE_PIXELS = 11
const LOUPE_ZOOM = 10

interface Point {
  x: number
  y: number
}

interface ImagePickerProps {
  current: string
  onPick: (hex: string) => void
}

export function ImagePicker({ current, onPick }: ImagePickerProps) {
  const [image, setImage] = useState<ImageData | null>(null)
  const [palette, setPalette] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Where the loupe is, in image pixels; null when it's hidden. */
  const [cursor, setCursor] = useState<Point | null>(null)
  const [picked, setPicked] = useState<Point | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const loadIdRef = useRef(0)

  async function handleFile(file: File) {
    const problem = validateImage(file)
    if (problem) {
      setError(problem)
      return
    }
    const id = ++loadIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await loadImageData(file)
      if (id !== loadIdRef.current) return
      setImage(data)
      setPalette(mainColors(data))
      setCursor(null)
      setPicked(null)
    } catch {
      if (id === loadIdRef.current) setError("Couldn't open that image. Try another one.")
    } finally {
      if (id === loadIdRef.current) setLoading(false)
    }
  }

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      void handleFile(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    if (image) canvasRef.current?.getContext('2d')?.putImageData(image, 0, 0)
  }, [image])

  // Redraw the zoomed-in pixels around the cursor.
  useEffect(() => {
    const source = canvasRef.current
    const ctx = loupeRef.current?.getContext('2d')
    if (!cursor || !source || !ctx) return
    const half = Math.floor(LOUPE_PIXELS / 2)
    const size = LOUPE_PIXELS * LOUPE_ZOOM
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(source, cursor.x - half, cursor.y - half, LOUPE_PIXELS, LOUPE_PIXELS, 0, 0, size, size)
  }, [cursor])

  function pointAt(e: PointerEvent<HTMLCanvasElement>): Point | null {
    if (!image) return null
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * image.width)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * image.height)
    return {
      x: Math.min(image.width - 1, Math.max(0, x)),
      y: Math.min(image.height - 1, Math.max(0, y)),
    }
  }

  function pick(point: Point) {
    if (!image) return
    setPicked(point)
    onPick(pixelHex(image, point.x, point.y))
  }

  function onCanvasKey(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!image) return
    const at = cursor ?? { x: Math.floor(image.width / 2), y: Math.floor(image.height / 2) }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(at)
      return
    }
    const step = e.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    setCursor({
      x: Math.min(image.width - 1, Math.max(0, at.x + move[0])),
      y: Math.min(image.height - 1, Math.max(0, at.y + move[1])),
    })
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const fileInput = (
    <input
      type="file"
      className="sr-only"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) void handleFile(file)
        // Allow picking the same file again.
        e.target.value = ''
      }}
    />
  )

  const percent = (p: Point) =>
    image ? { left: `${((p.x + 0.5) / image.width) * 100}%`, top: `${((p.y + 0.5) / image.height) * 100}%` } : {}

  return (
    <section
      className="card cp-image"
      aria-labelledby="cp-image-title"
      aria-busy={loading}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <h2 id="cp-image-title" className="section-title">
        From an image
      </h2>

      {image ? (
        <>
          <div
            className="cp-image-frame"
            data-dragging={dragging}
            // Fill the card width, but no taller than the max height, keeping the image's shape.
            style={{ width: `min(100%, calc(var(--cp-image-max-h) * ${image.width / image.height}))` }}
          >
            <canvas
              ref={canvasRef}
              width={image.width}
              height={image.height}
              className="cp-image-canvas"
              tabIndex={0}
              aria-label="Your image. Move the crosshair with the arrow keys and press Enter to pick that color."
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setCursor(pointAt(e))
              }}
              onPointerMove={(e) => {
                if (e.pointerType === 'mouse' || e.buttons) setCursor(pointAt(e))
              }}
              onPointerUp={(e) => {
                const point = pointAt(e)
                if (point) pick(point)
                if (e.pointerType !== 'mouse') setCursor(null)
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') setCursor(null)
              }}
              onKeyDown={onCanvasKey}
              onBlur={() => setCursor(null)}
            />
            {picked && <span className="cp-image-marker" style={percent(picked)} aria-hidden="true" />}
            {cursor && (
              <div
                className="cp-loupe"
                style={percent(cursor)}
                data-below={cursor.y < image.height * 0.35}
                aria-hidden="true"
              >
                <canvas
                  ref={loupeRef}
                  width={LOUPE_PIXELS * LOUPE_ZOOM}
                  height={LOUPE_PIXELS * LOUPE_ZOOM}
                />
                <span className="cp-loupe-hex">{pixelHex(image, cursor.x, cursor.y)}</span>
              </div>
            )}
          </div>

          <p className="hint">Click or tap the image to pick a color. You can also paste or drop another image.</p>

          <div className="cp-image-actions">
            <label className="btn btn-secondary">
              {fileInput}
              <Icon name="upload" size={18} />
              Use another image
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                loadIdRef.current++
                setImage(null)
                setPalette([])
                setCursor(null)
                setPicked(null)
                setError(null)
              }}
            >
              <Icon name="close" size={18} />
              Clear
            </button>
          </div>

          {palette.length > 0 && (
            <div className="cp-image-palette">
              <h3 className="cp-subtitle">Main colors</h3>
              <SwatchRow colors={palette} current={current} onPick={onPick} />
            </div>
          )}
        </>
      ) : (
        <label className="cp-dropzone" data-active={dragging}>
          {fileInput}
          <Icon name="image" size={40} />
          <span className="cp-dropzone-title">{loading ? 'Opening your image…' : 'Drop an image here'}</span>
          <span className="hint">or click to pick one, or paste it (up to 20 MB). It stays on your device.</span>
        </label>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
