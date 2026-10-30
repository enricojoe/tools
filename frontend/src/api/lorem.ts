import { toApiError } from './client'

export type LoremUnit = 'paragraphs' | 'sentences' | 'words'

/** Largest count the backend accepts per unit. */
export const MAX_COUNT: Record<LoremUnit, number> = {
  paragraphs: 50,
  sentences: 200,
  words: 2000,
}

export interface LoremRequest {
  unit: LoremUnit
  count: number
  startWithLorem: boolean
  /** Omit for random text; the response says which seed was used. */
  seed?: number
}

/** Raw `GET /api/lorem` response. */
export interface LoremResult {
  unit: LoremUnit
  count: number
  seed: number
  /** Sentences and words come back as a single paragraph. */
  paragraphs: string[]
  words: number
}

function isLoremResult(body: unknown): body is LoremResult {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.unit === 'string' &&
    typeof b.count === 'number' &&
    typeof b.seed === 'number' &&
    typeof b.words === 'number' &&
    Array.isArray(b.paragraphs) &&
    b.paragraphs.every((p) => typeof p === 'string')
  )
}

/** Generates lorem ipsum text; the same seed and options always give the same text. */
export async function fetchLorem(req: LoremRequest, signal?: AbortSignal): Promise<LoremResult> {
  const params = new URLSearchParams({
    unit: req.unit,
    count: String(req.count),
    startWithLorem: String(req.startWithLorem),
  })
  if (req.seed !== undefined) params.set('seed', String(req.seed))

  const res = await fetch(`/api/lorem?${params}`, { signal })
  if (!res.ok) throw await toApiError(res)

  const body: unknown = await res.json()
  if (!isLoremResult(body)) throw new Error('The server sent an unexpected lorem ipsum response.')
  return body
}
