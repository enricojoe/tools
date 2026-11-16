import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/** Zoom, and the image's offset from the middle of the stage in px. */
export interface View {
  zoom: number
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

const MIN_ZOOM = 0.05
const MAX_ZOOM = 64
// Fit doesn't blow a tiny icon up past this.
const MAX_FIT = 16
export const ZOOM_STEP = 1.25
const PAN_STEP = 40
const START: View = { zoom: 1, x: 0, y: 0 }

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Zooms by `factor` keeping the point `at` (relative to the stage middle) still. */
function zoomView(v: View, factor: number, at = { x: 0, y: 0 }): View {
  const zoom = clampZoom(v.zoom * factor)
  const k = zoom / v.zoom
  return { zoom, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }
}

/** The zoom that fits an image of `size` in the stage, centered, `pad` px clear around it in all. */
export function fitTo(size: Size, stage: Size, pad = 48): View {
  const zoom = Math.min((stage.width - pad) / size.width, (stage.height - pad) / size.height, MAX_FIT)
  return { zoom: clampZoom(zoom), x: 0, y: 0 }
}

/**
 * Zoom and pan for one or more stages that move together: wheel / pinch
 * zooms around the cursor, dragging pans, and keys `+` `-` `0` (fit) `1`
 * (100%) and the arrows. Attach `stageRef` and `stageProps` to each stage.
 * `size` is the image size Fit works from; null while there's nothing to show.
 * `pad` is the room Fit leaves around it, for docks drawn over the stage.
 */
export function usePanZoom(size: Size | null, pad = 48) {
  const [view, setView] = useState<View>(START)
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  // A callback ref, so it works for stages that come and go. A passive React
  // wheel handler can't stop the page scrolling, so the wheel is listened to directly.
  const stageRef = useCallback((stage: HTMLDivElement | null) => {
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(stage)
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = stage!.getBoundingClientRect()
      const at = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 }
      setView((v) => zoomView(v, Math.exp(-e.deltaY * 0.002), at))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      stage.removeEventListener('wheel', onWheel)
    }
  }, [])

  function fit(): View {
    return size ? fitTo(size, stageSize, pad) : START
  }

  function zoomBy(factor: number) {
    setView((v) => zoomView(v, factor))
  }

  function zoomActual() {
    setView((v) => zoomView(v, 1 / v.zoom))
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !size) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y }
    setDragging(true)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    setView((v) => ({ ...v, x: start.x + e.clientX - start.px, y: start.y + e.clientY - start.py }))
  }

  function onPointerUp() {
    dragStart.current = null
    setDragging(false)
  }

  function onKeyDown(e: KeyboardEvent) {
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
    }
    if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP)
    else if (e.key === '-') zoomBy(1 / ZOOM_STEP)
    else if (e.key === '0') setView(fit())
    else if (e.key === '1') zoomActual()
    else if (pan[e.key]) {
      const [dx, dy] = pan[e.key]
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    } else return
    e.preventDefault()
  }

  return {
    view,
    setView,
    stageSize,
    dragging,
    fit,
    zoomBy,
    zoomActual,
    stageRef,
    stageProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  }
}
