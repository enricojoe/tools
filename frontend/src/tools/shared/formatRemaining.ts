function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "MM:SS", or "H:MM:SS" from an hour up. Rounds up so it reads 00:01 until the very end. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
