// Line diff for comparing two SVGs side by side. Pure; no DOM or React.

export interface Line {
  /** 1-based line number. */
  no: number
  text: string
}

export interface Row {
  kind: 'same' | 'change' | 'del' | 'add'
  left: Line | null
  right: Line | null
}

export type Piece = { kind: 'rows'; rows: Row[] } | { kind: 'fold'; at: number; rows: Row[] }

// Past this many differences the diff gives up and shows the rest as replaced,
// so a huge unrelated pair can't freeze the page.
const MAX_EDITS = 2000

type Op = 'same' | 'del' | 'add'

/**
 * The edit script from `a` to `b` (Myers' O(ND) algorithm), as one op per
 * line: 'same' uses a line of both, 'del' one of `a`, 'add' one of `b`.
 */
export function diffOps(a: string[], b: string[]): Op[] {
  // Equal starts and ends are common and cheap to take off first.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  const x0 = a.slice(start, a.length - end)
  const y0 = b.slice(start, b.length - end)
  const middle = myers(x0, y0) ?? [...x0.map((): Op => 'del'), ...y0.map((): Op => 'add')]
  return [...Array<Op>(start).fill('same'), ...middle, ...Array<Op>(end).fill('same')]
}

function myers(a: string[], b: string[]): Op[] | null {
  const n = a.length
  const m = b.length
  const max = Math.min(n + m, MAX_EDITS)
  const off = max + 1
  const v = new Int32Array(2 * max + 3)
  // v after each step d, for k in -d..d, to walk the path back.
  const trace: Int32Array[] = []

  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[off + k] = x
      if (x >= n && y >= m) {
        trace.push(v.slice(off - d, off + d + 1))
        return backtrack(trace, n, m)
      }
    }
    trace.push(v.slice(off - d, off + d + 1))
  }
  return null
}

function backtrack(trace: Int32Array[], n: number, m: number): Op[] {
  const ops: Op[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d > 0; d--) {
    const prev = trace[d - 1]
    const at = (k: number) => prev[k + d - 1]
    const k = x - y
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1
    const prevX = at(prevK)
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      ops.push('same')
      x--
      y--
    }
    ops.push(prevK === k + 1 ? 'add' : 'del')
    x = prevX
    y = prevY
  }
  while (x > 0 && y > 0) {
    ops.push('same')
    x--
    y--
  }
  return ops.reverse()
}

/**
 * Side-by-side rows: unchanged lines on both sides, and each block of
 * changes with removed lines on the left paired up with added ones on the right.
 */
export function diffRows(a: string[], b: string[]): Row[] {
  const rows: Row[] = []
  let i = 0
  let j = 0
  let dels: Line[] = []
  let adds: Line[] = []
  const flush = () => {
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      const left = dels[k] ?? null
      const right = adds[k] ?? null
      rows.push({ kind: left && right ? 'change' : left ? 'del' : 'add', left, right })
    }
    dels = []
    adds = []
  }
  for (const op of diffOps(a, b)) {
    if (op === 'same') {
      flush()
      rows.push({ kind: 'same', left: { no: i + 1, text: a[i] }, right: { no: j + 1, text: b[j] } })
      i++
      j++
    } else if (op === 'del') {
      dels.push({ no: i + 1, text: a[i] })
      i++
    } else {
      adds.push({ no: j + 1, text: b[j] })
      j++
    }
  }
  flush()
  return rows
}

/** Runs of unchanged rows more than `context` rows from a change, folded away. */
export function foldRows(rows: Row[], context = 3): Piece[] {
  const near = new Uint8Array(rows.length)
  rows.forEach((r, i) => {
    if (r.kind === 'same') return
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) near[k] = 1
  })
  const pieces: Piece[] = []
  let i = 0
  while (i < rows.length) {
    const folded = rows[i].kind === 'same' && !near[i]
    let j = i
    while (j < rows.length && (rows[j].kind === 'same' && !near[j]) === folded) j++
    // Folding one or two lines saves nothing.
    if (folded && j - i > 2) pieces.push({ kind: 'fold', at: i, rows: rows.slice(i, j) })
    else {
      const last = pieces[pieces.length - 1]
      if (last?.kind === 'rows') last.rows.push(...rows.slice(i, j))
      else pieces.push({ kind: 'rows', rows: rows.slice(i, j) })
    }
    i = j
  }
  return pieces
}

/** The part of each line that differs, after the shared start and end: [from, to) in each. */
export function changedRange(a: string, b: string): { a: [number, number]; b: [number, number] } {
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return { a: [p, a.length - s], b: [p, b.length - s] }
}
