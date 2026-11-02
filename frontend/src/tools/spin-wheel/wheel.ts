// Geometry for the spin wheel: slices start at 12 o'clock and run clockwise,
// and the pointer sits at the top, so the slice under it depends only on how
// far the wheel has turned.

import { randomFraction, randomInt } from '../shared/random'

export const MAX_ENTRIES = 100

// Text color per fill so labels stay readable on every slice.
export const SLICE_COLORS: { fill: string; text: string }[] = [
  { fill: '#1d4ed8', text: '#fff' },
  { fill: '#facc15', text: '#172033' },
  { fill: '#dc2626', text: '#fff' },
  { fill: '#38bdf8', text: '#172033' },
  { fill: '#7c3aed', text: '#fff' },
  { fill: '#4ade80', text: '#172033' },
  { fill: '#f472b6', text: '#172033' },
  { fill: '#fb923c', text: '#172033' },
]

/** The non-empty lines of the entries box, trimmed, capped at MAX_ENTRIES. */
export function parseEntries(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_ENTRIES)
}

/** Color for slice i of n, never matching the slice beside it where the wheel wraps around. */
export function sliceColor(i: number, n: number) {
  const len = SLICE_COLORS.length
  const wrapsOntoFirst = n > 1 && i === n - 1 && i % len === 0
  return SLICE_COLORS[wrapsOntoFirst ? 1 : i % len]
}

function point(deg: number, r: number): string {
  const rad = ((deg - 90) * Math.PI) / 180
  return `${(r * Math.cos(rad)).toFixed(3)} ${(r * Math.sin(rad)).toFixed(3)}`
}

/** SVG path for a slice between two angles (degrees clockwise from the top), centered on 0,0. */
export function slicePath(from: number, to: number, r: number): string {
  const large = to - from > 180 ? 1 : 0
  return `M0 0L${point(from, r)}A${r} ${r} 0 ${large} 1 ${point(to, r)}Z`
}

/** Picks a winner and the rotation (degrees, always forward from `current`)
 * that stops the wheel on it, somewhere inside the slice rather than on an edge. */
export function planSpin(current: number, count: number, turns: number): { winner: number; rotation: number } {
  const winner = randomInt(count)
  const per = 360 / count
  const stopAt = (winner + 0.1 + 0.8 * randomFraction()) * per
  // The wheel angle under the pointer is -rotation, so aim rotation at -stopAt.
  const target = (((360 - stopAt - current) % 360) + 360) % 360
  return { winner, rotation: current + turns * 360 + target }
}

/** Shortens a label so it fits along a slice. */
export function clip(label: string, max: number): string {
  const chars = [...label]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : label
}
