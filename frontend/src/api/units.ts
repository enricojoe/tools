import { toApiError } from './client'

export interface UnitInfo {
  id: string
  name: string
  symbol: string
}

export interface UnitCategory {
  id: string
  name: string
  units: UnitInfo[]
}

export interface UnitResult {
  unit: string
  value: number
}

/** Raw `GET /api/units/convert` response. */
export interface Conversion {
  category: string
  from: string
  value: number
  /** The value in every unit of the category, in the order of `GET /api/units`. */
  results: UnitResult[]
}

function isUnitInfo(v: unknown): v is UnitInfo {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.symbol === 'string'
}

function isCategory(v: unknown): v is UnitCategory {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.units) &&
    o.units.every(isUnitInfo)
  )
}

function isConversion(body: unknown): body is Conversion {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.category === 'string' &&
    typeof b.from === 'string' &&
    typeof b.value === 'number' &&
    Array.isArray(b.results) &&
    b.results.every((r: unknown) => {
      if (typeof r !== 'object' || r === null) return false
      const o = r as Record<string, unknown>
      return typeof o.unit === 'string' && typeof o.value === 'number'
    })
  )
}

/** Lists every unit category with its units, in display order. */
export async function fetchUnitCategories(signal?: AbortSignal): Promise<UnitCategory[]> {
  const res = await fetch('/api/units', { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  const categories =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).categories : null
  if (!Array.isArray(categories) || !categories.every(isCategory)) {
    throw new Error('The server sent an unexpected units response.')
  }
  return categories
}

/** Converts `value` from unit `from` to every unit of `category`. */
export async function convertUnit(
  category: string,
  from: string,
  value: string,
  signal?: AbortSignal,
): Promise<Conversion> {
  const params = new URLSearchParams({ category, from, value })
  const res = await fetch(`/api/units/convert?${params}`, { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isConversion(body)) throw new Error('The server sent an unexpected conversion response.')
  return body
}
