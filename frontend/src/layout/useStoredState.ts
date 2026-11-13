import { useEffect, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** `useState` that is saved in `localStorage` under `key`, for small per-device UI choices. */
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback))

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage blocked (e.g. private mode): the choice lasts for this visit only.
    }
  }, [key, value])

  return [value, setValue] as const
}
