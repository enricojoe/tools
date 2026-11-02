// Fair random picks for the spin wheel, dice and coin flip.

const RANGE = 2 ** 32

/** A uniform integer in [0, max). Uses the crypto RNG and rejects the
 * top sliver of values so every result is exactly equally likely. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > RANGE) throw new RangeError(`bad max: ${max}`)
  const limit = RANGE - (RANGE % max)
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

/** A uniform float in [0, 1), for decoration such as where in a slice the wheel stops. */
export function randomFraction(): number {
  return randomInt(RANGE) / RANGE
}

/** A shuffled copy (Fisher–Yates). */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** True when the user asked the OS for less motion; animations are skipped. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
