import { useEffect, useState } from 'react'

/** The current time in whole seconds, ticking once a second. */
export function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** Pretty JSON: two-space indent, as people expect to read it. */
export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** Parses JSON that must be an object; the error says where it went wrong. */
export function parseObject(text: string, what: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const value: unknown = JSON.parse(text)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: `The ${what} must be a JSON object ({ … }).` }
    }
    return { ok: true, value: value as Record<string, unknown> }
  } catch (e) {
    const detail = e instanceof Error ? e.message.replace(/^JSON\.parse: /, '') : ''
    return { ok: false, error: `The ${what} isn't valid JSON${detail ? `: ${detail}` : '.'}` }
  }
}
