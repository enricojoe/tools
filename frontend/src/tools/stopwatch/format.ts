/** "01:23.45", or "1:02:03.45" once past an hour: elapsed milliseconds as a stopwatch reading. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 10))
  const cs = total % 100
  const s = Math.floor(total / 100) % 60
  const m = Math.floor(total / 6000) % 60
  const h = Math.floor(total / 360000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${h > 0 ? `${h}:${pad(m)}` : pad(m)}:${pad(s)}.${pad(cs)}`
}

/** Spoken form for screen readers: "1 minute 5.20 seconds". */
export function describeElapsed(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = (totalSeconds % 60).toFixed(2)
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  parts.push(`${s} seconds`)
  return parts.join(' ')
}
