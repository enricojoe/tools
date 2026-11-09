// SVG parsing, details, formatting and sizing for the SVG viewer. Runs in the
// browser (DOMParser / XMLSerializer); no React.

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

/** What browsers draw for an SVG with no size and no viewBox. */
const DEFAULT_SIZE = { width: 300, height: 150 }

export interface SvgInfo {
  /** Size in px used for the preview and as the 1× export. */
  width: number
  height: number
  sizeFrom: 'attributes' | 'viewBox' | 'default'
  widthAttr: string | null
  heightAttr: string | null
  viewBox: string | null
  elements: number
  /** Tag names by how often they appear, most first. */
  tags: [string, number][]
  colors: { value: string; count: number }[]
  usesCurrentColor: boolean
  /** Things that won't show in the preview or behave differently elsewhere. */
  warnings: string[]
  /** What was fixed so the SVG could be shown. */
  fixes: string[]
}

export type ParseResult =
  | { ok: true; svg: Element; info: SvgInfo }
  | { ok: false; error: string }

// The `<svg …>` start tag; attribute values may contain `>`.
const SVG_START = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/

/**
 * Parses SVG code. Adds a missing `xmlns` / `xmlns:xlink` to the first
 * `<svg>` tag, and finds an `<svg>` wrapped in other markup.
 */
export function parseSvg(source: string): ParseResult {
  const start = SVG_START.exec(source)
  if (!start) return { ok: false, error: 'There’s no <svg> tag in this code.' }

  const fixes: string[] = []
  let tag = start[0]
  if (!/\sxmlns\s*=/.test(tag)) {
    tag = tag.replace(/^<svg/, `<svg xmlns="${SVG_NS}"`)
    fixes.push('Added the missing xmlns="http://www.w3.org/2000/svg" (common in SVG copied out of HTML).')
  }
  if (/\bxlink:/.test(source) && !/\sxmlns:xlink\s*=/.test(tag)) {
    tag = tag.replace(/^<svg/, `<svg xmlns:xlink="${XLINK_NS}"`)
    fixes.push('Added the missing xmlns:xlink for the xlink: attributes.')
  }
  const fixed = source.slice(0, start.index) + tag + source.slice(start.index + start[0].length)

  const doc = new DOMParser().parseFromString(fixed, 'image/svg+xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]
  if (parserError) return { ok: false, error: parserErrorMessage(parserError) }

  const root = doc.documentElement
  const svg = isSvg(root) ? root : [...root.getElementsByTagNameNS(SVG_NS, 'svg')][0]
  if (!svg) return { ok: false, error: 'There’s no <svg> element in this code.' }
  if (svg !== root) fixes.push(`Showing the first <svg> inside <${root.tagName}>.`)

  return { ok: true, svg, info: { ...describe(svg), fixes } }
}

function isSvg(el: Element): boolean {
  return el.namespaceURI === SVG_NS && el.localName === 'svg'
}

// Chrome puts the message in a <div>; Firefox adds "Location:" and the source line.
function parserErrorMessage(el: Element): string {
  const text = (el.querySelector('div') ?? el).textContent ?? ''
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('Location:') && !l.startsWith('Below is') && !l.startsWith('This page contains'))
  const message = lines
    .slice(0, 2)
    .join(' ')
    .replace(/^XML Parsing Error:\s*/, '')
    .replace(/^error on line (\d+) at column (\d+):\s*/, 'line $1, column $2: ')
    .replace(/\{[^}]*\}/g, '')
  return `This isn’t valid SVG: ${message.length > 300 ? message.slice(0, 300) + '…' : message || 'the XML is broken.'}`
}

const UNIT_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
  em: 16,
  ex: 8,
}

/** A width / height attribute in px, or null for percentages, `auto` and junk. */
export function lengthToPx(value: string | null): number | null {
  if (value === null) return null
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value)
  const unit = m ? UNIT_PX[m[2].toLowerCase()] : undefined
  if (!m || unit === undefined) return null
  const px = Number(m[1]) * unit
  return px > 0 && Number.isFinite(px) ? px : null
}

export function parseViewBox(value: string | null): { x: number; y: number; width: number; height: number } | null {
  if (value === null) return null
  const parts = value.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [x, y, width, height] = parts
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

const COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']
const NOT_COLORS = new Set([
  'none', 'transparent', 'inherit', 'initial', 'unset', 'revert', 'currentcolor', 'context-fill', 'context-stroke',
])
const CSS_COLOR_DECL = new RegExp(`(?:^|[;{\\s])(${COLOR_PROPS.join('|')})\\s*:\\s*([^;}{]+)`, 'gi')

function normalizeColor(raw: string): string {
  const value = raw.replace(/!important/i, '').trim().toLowerCase()
  const short = /^#([0-9a-f]{3,4})$/.exec(value)
  return short ? '#' + [...short[1]].map((c) => c + c).join('') : value
}

function describe(svg: Element): Omit<SvgInfo, 'fixes'> {
  const widthAttr = svg.getAttribute('width')
  const heightAttr = svg.getAttribute('height')
  const viewBoxAttr = svg.getAttribute('viewBox')
  const w = lengthToPx(widthAttr)
  const h = lengthToPx(heightAttr)
  const vb = parseViewBox(viewBoxAttr)

  let size: { width: number; height: number }
  let sizeFrom: SvgInfo['sizeFrom'] = 'attributes'
  if (w && h) size = { width: w, height: h }
  else if (w && vb) size = { width: w, height: (w * vb.height) / vb.width }
  else if (h && vb) size = { width: (h * vb.width) / vb.height, height: h }
  else if (vb) {
    size = { width: vb.width, height: vb.height }
    sizeFrom = 'viewBox'
  } else {
    size = { width: w ?? DEFAULT_SIZE.width, height: h ?? DEFAULT_SIZE.height }
    sizeFrom = w || h ? 'attributes' : 'default'
  }

  const all = [svg, ...svg.getElementsByTagName('*')]
  const tagCounts = new Map<string, number>()
  const colorCounts = new Map<string, number>()
  let usesCurrentColor = false
  let handlers = false
  let bitmaps = 0
  const external = new Set<string>()

  function addColor(raw: string) {
    const value = normalizeColor(raw)
    if (value === 'currentcolor') usesCurrentColor = true
    if (value === '' || NOT_COLORS.has(value) || value.startsWith('url(') || value.startsWith('var(')) return
    colorCounts.set(value, (colorCounts.get(value) ?? 0) + 1)
  }

  function addCss(css: string) {
    for (const m of css.matchAll(CSS_COLOR_DECL)) addColor(m[2])
    for (const m of css.matchAll(/(?:@import\s+(?:url\()?|url\()\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi)) external.add(m[1])
  }

  for (const el of all) {
    tagCounts.set(el.localName, (tagCounts.get(el.localName) ?? 0) + 1)
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) handlers = true
      else if (COLOR_PROPS.includes(name)) addColor(attr.value)
      else if (name === 'style') addCss(';' + attr.value)
      else if (name === 'href' || name === 'xlink:href') {
        const href = attr.value.trim()
        if (/^(?:https?:)?\/\//i.test(href) && el.localName !== 'a') external.add(href)
        if (el.localName === 'image' && /^data:image\/(?!svg)/i.test(href)) bitmaps++
      }
    }
    if (el.localName === 'style') addCss(el.textContent ?? '')
  }

  const warnings: string[] = []
  const scripts = tagCounts.get('script') ?? 0
  if (scripts) warnings.push(`Has ${scripts === 1 ? 'a <script>' : `${scripts} <script>s`}; scripts don’t run in this preview.`)
  if (handlers) warnings.push('Has event handlers (onclick and the like); they don’t run in this preview.')
  if (external.size) {
    const first = [...external][0]
    const more = external.size > 1 ? ` and ${external.size - 1} more` : ''
    warnings.push(`Loads files from elsewhere (${first}${more}); the preview doesn’t fetch them, so parts may be missing.`)
  }
  if (bitmaps) {
    warnings.push(
      bitmaps === 1
        ? 'Has an embedded bitmap image, which goes blurry when zoomed in.'
        : `Has ${bitmaps} embedded bitmap images, which go blurry when zoomed in.`,
    )
  }
  if (tagCounts.has('foreignObject')) warnings.push('Has <foreignObject> (HTML inside SVG), which some apps and PNG exports leave out.')
  if (usesCurrentColor) warnings.push('Uses currentColor, which takes the color of the text around it; here it shows black.')

  return {
    ...size,
    sizeFrom,
    widthAttr,
    heightAttr,
    viewBox: viewBoxAttr,
    elements: all.length,
    tags: [...tagCounts].sort((a, b) => b[1] - a[1]),
    colors: [...colorCounts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    usesCurrentColor,
    warnings,
  }
}

/**
 * A copy of the SVG drawn at `width` × `height` px. A missing viewBox is set
 * from the original size first, so the drawing scales instead of being cropped.
 */
export function sizedSvg(svg: Element, info: SvgInfo, width: number, height: number): string {
  const copy = svg.cloneNode(true) as Element
  if (!parseViewBox(copy.getAttribute('viewBox'))) copy.setAttribute('viewBox', `0 0 ${info.width} ${info.height}`)
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  return new XMLSerializer().serializeToString(copy)
}

// Text in these is kept exactly, since spaces in it can show.
const KEEP_TEXT = new Set(['text', 'tspan', 'textPath', 'style', 'script', 'title', 'desc'])
const INDENT = '  '

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function serialize(node: Node, minify: boolean, depth: number, keep: boolean): string {
  const pad = minify || keep ? '' : '\n' + INDENT.repeat(depth)
  switch (node.nodeType) {
    case Node.TEXT_NODE: {
      const data = (node as Text).data
      return keep ? escapeText(data) : ''
    }
    case Node.CDATA_SECTION_NODE:
      return `${pad}<![CDATA[${(node as CDATASection).data}]]>`
    case Node.COMMENT_NODE:
      return minify ? '' : `${pad}<!--${(node as Comment).data}-->`
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = node as ProcessingInstruction
      return minify ? '' : `${pad}<?${pi.target} ${pi.data}?>`
    }
    case Node.ELEMENT_NODE: {
      const el = node as Element
      if (minify && el.localName === 'metadata') return ''
      const attrs = [...el.attributes]
        .map((a) => ` ${a.name}="${escapeAttr(minify ? a.value.replace(/\s+/g, ' ').trim() : a.value)}"`)
        .join('')
      const kids = [...el.childNodes]
      const mixed =
        keep || KEEP_TEXT.has(el.localName) || kids.some((k) => k.nodeType === Node.TEXT_NODE && (k as Text).data.trim() !== '')
      const inner = kids.map((k) => serialize(k, minify, depth + 1, mixed)).join('')
      if (inner === '') return `${pad}<${el.tagName}${attrs}/>`
      return `${pad}<${el.tagName}${attrs}>${inner}${mixed ? '' : pad}</${el.tagName}>`
    }
    default:
      return ''
  }
}

/** The SVG indented two spaces per level. Text inside <text>, <style> and the like is left as is. */
export function formatSvg(svg: Element): string {
  return serialize(svg, false, 0, false).trim() + '\n'
}

/** The SVG without comments, <metadata>, or whitespace between tags and in attributes. */
export function minifySvg(svg: Element): string {
  return serialize(svg, true, 0, false)
}

/**
 * A `data:image/svg+xml,…` URL, percent-encoding only what needs it, so it
 * stays readable and shorter than Base64.
 */
export function toDataUrl(svg: string): string {
  return 'data:image/svg+xml,' + svg.replace(/[^\x20-\x7e]|[%#()<>?[\\\]^`{|}"]/gu, encodeURIComponent)
}

/** Size of the text in bytes as UTF-8. */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}
