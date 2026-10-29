import type { UnitCategory } from '../../api/units'

const STORAGE_KEY = 'unit-converter'

/** Sensible starting units per category, used until the user picks their own. */
const DEFAULT_PAIRS: Record<string, [string, string]> = {
  length: ['m', 'ft'],
  mass: ['kg', 'lb'],
  temperature: ['c', 'f'],
  volume: ['l', 'gal'],
  area: ['m2', 'ft2'],
  speed: ['kmh', 'mph'],
  time: ['h', 'min'],
  data: ['MB', 'GB'],
  pressure: ['bar', 'psi'],
  energy: ['kj', 'kcal'],
}

export interface UnitPair {
  from: string
  to: string
}

interface Stored {
  category: string
  pairs: Record<string, UnitPair>
}

export function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data: unknown = raw === null ? null : JSON.parse(raw)
    if (typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>
      if (typeof d.category === 'string' && typeof d.pairs === 'object' && d.pairs !== null) {
        return { category: d.category, pairs: d.pairs as Record<string, UnitPair> }
      }
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return { category: 'length', pairs: {} }
}

export function storeStored(stored: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage full or blocked: the choice just won't be remembered.
  }
}

/** The remembered (or default) from/to pair, checked against the category's real units. */
export function pairFor(category: UnitCategory, remembered: UnitPair | undefined): UnitPair {
  const has = (id: unknown) => category.units.some((u) => u.id === id)
  if (remembered && has(remembered.from) && has(remembered.to)) return remembered

  const [from, to] = DEFAULT_PAIRS[category.id] ?? []
  if (has(from) && has(to)) return { from, to }
  const first = category.units[0]?.id ?? ''
  return { from: first, to: category.units[1]?.id ?? first }
}

const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i
const MAX_ABS = 1e15

/** The input as a number for the API, or null when it is empty or not a usable number. */
export function parseInput(text: string): string | null {
  const t = text.trim()
  if (!NUMBER_RE.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && Math.abs(n) <= MAX_ABS ? t : null
}

const plain = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 10 })

function isExtreme(n: number): boolean {
  const abs = Math.abs(n)
  return abs !== 0 && (abs >= 1e12 || abs < 1e-6)
}

function trimExponent(n: number): string {
  const [mantissa, exp] = n.toExponential(9).split('e')
  const trimmed = mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa
  return `${trimmed}e${exp.replace('+', '')}`
}

/** Readable display: up to 10 significant digits, grouped, exponent for huge or tiny values. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-'
  if (isExtreme(n)) return trimExponent(n)
  return plain.format(Object.is(n, -0) ? 0 : n)
}

/** Same rounding as `formatNumber` but ungrouped, for copying into other apps. */
export function formatPlain(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (isExtreme(n)) return trimExponent(n)
  return String(Number(n.toPrecision(10)))
}
