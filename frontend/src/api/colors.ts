import { toApiError } from './client'

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export interface Hsv {
  h: number
  s: number
  v: number
}

export interface Cmyk {
  c: number
  m: number
  y: number
  k: number
}

export interface Harmonies {
  complementary: string[]
  analogous: string[]
  triadic: string[]
  splitComplementary: string[]
  tetradic: string[]
}

/** Raw `GET /api/colors` response. */
export interface ColorInfo {
  /** Normalised, e.g. "#3B82F6". */
  hex: string
  rgb: Rgb
  hsl: Hsl
  hsv: Hsv
  cmyk: Cmyk
  /** Nearest CSS named color. */
  name: string
  /** True when `name` is an exact match rather than the nearest one. */
  exactName: boolean
  contrast: {
    /** WCAG contrast ratio against white text. */
    white: number
    /** WCAG contrast ratio against black text. */
    black: number
    /** "#FFFFFF" or "#000000": whichever reads better on this color. */
    bestText: string
  }
  harmonies: Harmonies
  /** Nine hexes, light to dark. */
  shades: string[]
}

function isNumbers(v: unknown, keys: string[]): boolean {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return keys.every((k) => typeof o[k] === 'number')
}

function isStrings(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isColorInfo(body: unknown): body is ColorInfo {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  const contrast = b.contrast as Record<string, unknown> | null
  const harmonies = b.harmonies as Record<string, unknown> | null
  return (
    typeof b.hex === 'string' &&
    isNumbers(b.rgb, ['r', 'g', 'b']) &&
    isNumbers(b.hsl, ['h', 's', 'l']) &&
    isNumbers(b.hsv, ['h', 's', 'v']) &&
    isNumbers(b.cmyk, ['c', 'm', 'y', 'k']) &&
    typeof b.name === 'string' &&
    typeof b.exactName === 'boolean' &&
    typeof contrast === 'object' &&
    contrast !== null &&
    typeof contrast.white === 'number' &&
    typeof contrast.black === 'number' &&
    typeof contrast.bestText === 'string' &&
    typeof harmonies === 'object' &&
    harmonies !== null &&
    ['complementary', 'analogous', 'triadic', 'splitComplementary', 'tetradic'].every((k) =>
      isStrings(harmonies[k]),
    ) &&
    isStrings(b.shades)
  )
}

/** Looks up formats, name, contrast, harmonies and shades for a hex color (3 or 6 digits, no `#`). */
export async function fetchColor(hex: string, signal?: AbortSignal): Promise<ColorInfo> {
  const res = await fetch(`/api/colors?hex=${encodeURIComponent(hex)}`, { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isColorInfo(body)) throw new Error('The server sent an unexpected color response.')
  return body
}
