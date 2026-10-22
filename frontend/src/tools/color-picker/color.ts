/** Local color math and storage for the picker, so dragging never waits on the server. */

export interface HsvColor {
  /** 0–360 */
  h: number
  /** 0–1 */
  s: number
  /** 0–1 */
  v: number
}

export function clampUnit(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function hsvToRgb({ h, s, v }: HsvColor): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)]
}

function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const delta = max - Math.min(rn, gn, bn)
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex(color: HsvColor): string {
  const [r, g, b] = hsvToRgb(color)
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Parses "#abc", "abc", "#aabbcc" or "aabbcc" into "#AABBCC", or null when it isn't a hex color. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return null
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return '#' + digits.toUpperCase()
}

/**
 * Hex to HSV. A grey or black has no hue of its own, so `keepHue` is used for it
 * and the hue slider doesn't jump.
 */
export function hexToHsv(hex: string, keepHue: number): HsvColor | null {
  const n = normalizeHex(hex)
  if (!n) return null
  const c = rgbToHsv(parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16))
  return c.s === 0 || c.v === 0 ? { ...c, h: keepHue } : c
}

/** WCAG minimum contrast ratios for text. */
export const WCAG = { aa: 4.5, aaa: 7 } as const

// Saved colors

const STORAGE_KEY = 'color-picker:saved'
export const MAX_SAVED = 24

export function loadSaved(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const hexes = parsed.flatMap((v) => (typeof v === 'string' ? (normalizeHex(v) ?? []) : []))
    return [...new Set(hexes)].slice(0, MAX_SAVED)
  } catch {
    return []
  }
}

export function storeSaved(colors: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
  } catch {
    // Storage unavailable or full: saved colors just won't survive a reload.
  }
}
