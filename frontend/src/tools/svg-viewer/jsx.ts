// SVG → JSX / React component for the SVG viewer. Works on a parsed <svg>
// element; no React.

import { parseViewBox, type SvgInfo } from './svg'

export interface JsxOptions {
  /** A whole component, or just the JSX. */
  component: boolean
  typescript: boolean
  /** `{...props}` on the <svg>, so callers can set className, size, onClick… */
  spreadProps: boolean
  /** Drop width / height so CSS sizes it (a viewBox is added if missing). */
  dropSize: boolean
  name: string
}

export interface JsxResult {
  code: string
  /** What was left out or changed, for the user to know. */
  notes: string[]
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const INDENT = '  '
const MAX_LINE = 100

// Kept as they are: text in these can show or matters.
const KEEP_TEXT = new Set(['text', 'tspan', 'textPath', 'title', 'desc'])
// Not valid or not useful in React.
const DROP_TAGS = new Set(['script', 'metadata'])

// Attributes React spells differently from SVG / HTML.
const RENAMED: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  'xml:lang': 'xmlLang',
  'xml:space': 'xmlSpace',
  'xlink:href': 'href',
  'xlink:title': 'xlinkTitle',
  'xlink:show': 'xlinkShow',
  'xlink:role': 'xlinkRole',
  'xlink:arcrole': 'xlinkArcrole',
  'xlink:actuate': 'xlinkActuate',
  'xlink:type': 'xlinkType',
  'xmlns:xlink': 'xmlnsXlink',
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

/** A component name from a file name: `arrow-left` → `ArrowLeft`. */
export function componentName(fileName: string | null): string {
  const words = (fileName ?? '').split(/[^a-zA-Z0-9]+/).filter(Boolean)
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  if (!name) return 'SvgImage'
  return /^[0-9]/.test(name) ? 'Svg' + name : name
}

/** Whether a name the user typed works as a component name as it is. */
export function validName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9_$]*$/.test(name)
}

/** A JSX attribute value: a plain string when it can be, else an expression. */
function attrValue(value: string): string {
  return /["{}\\\n]/.test(value) || value !== value.trim() ? `{${JSON.stringify(value)}}` : `"${value}"`
}

/** `fill: red; stroke-width: 2` → `{{ fill: 'red', strokeWidth: '2' }}`. */
function styleObject(css: string): string | null {
  const parts: string[] = []
  // Split on semicolons that aren't inside url(…) or quotes.
  for (const decl of css.match(/(?:[^;"'(]|"[^"]*"|'[^']*'|\([^)]*\))+/g) ?? []) {
    const colon = decl.indexOf(':')
    if (colon < 0) continue
    const prop = decl.slice(0, colon).trim()
    const value = decl.slice(colon + 1).trim()
    if (!prop || !value) continue
    parts.push(`${styleKey(prop)}: ${quote(value)}`)
  }
  return parts.length ? `{{ ${parts.join(', ')} }}` : null
}

/** A CSS property as a React style key: `stroke-width` → `strokeWidth`, `-webkit-mask` → `WebkitMask`. */
function styleKey(prop: string): string {
  if (prop.startsWith('--')) return quote(prop)
  const p = prop.toLowerCase()
  if (p.startsWith('-ms-')) return camel(p.slice(1))
  if (p.startsWith('-')) return camel(p.slice(1)).replace(/^[a-z]/, (c) => c.toUpperCase())
  return camel(p)
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** Text between tags, escaped so JSX shows it as written. */
function jsxText(text: string): string {
  return /[{}<>]/.test(text) || text !== text.trim() || /\s{2,}/.test(text) ? `{${JSON.stringify(text)}}` : text
}

// Editor attributes and namespaces (Inkscape, Sodipodi, Illustrator, Sketch…)
// React can't take, since JSX names can't have a prefix.
function isForeignName(name: string): boolean {
  if (name.startsWith('xmlns:')) return name !== 'xmlns:xlink'
  const prefix = name.includes(':') ? name.slice(0, name.indexOf(':')) : null
  return prefix !== null && prefix !== 'xlink' && prefix !== 'xml'
}

export function svgToJsx(svg: Element, info: SvgInfo, options: JsxOptions): JsxResult {
  const dropped = { comments: 0, scripts: 0, handlers: 0, foreign: 0, metadata: 0 }
  let usesXlink = false

  // First pass: does anything still need xmlns:xlink once xlink:href is plain href?
  for (const el of [svg, ...svg.getElementsByTagName('*')]) {
    for (const attr of el.attributes) {
      if (attr.namespaceURI === XLINK_NS && attr.localName !== 'href') usesXlink = true
    }
  }

  function attrs(el: Element, isRoot: boolean): string[] {
    const out: string[] = []
    for (const attr of el.attributes) {
      const name = attr.name
      const lower = name.toLowerCase()
      if (lower.startsWith('on')) {
        dropped.handlers++
        continue
      }
      if (name === 'xmlns:xlink' && !usesXlink) continue
      if (isForeignName(name)) {
        dropped.foreign++
        continue
      }
      if (isRoot && options.dropSize && (name === 'width' || name === 'height')) continue
      let jsxName: string
      if (RENAMED[lower]) jsxName = RENAMED[lower]
      else if (attr.namespaceURI === XML_NS) jsxName = camel('xml-' + attr.localName)
      else if (/^(data|aria)-/.test(lower)) jsxName = lower
      else jsxName = camel(name)

      if (jsxName === 'style') {
        const obj = styleObject(attr.value)
        if (obj) out.push(`style=${obj}`)
        continue
      }
      // Line breaks and runs of spaces in path data and the like mean nothing.
      const value = KEEP_TEXT.has(el.localName) ? attr.value : attr.value.replace(/\s+/g, ' ').trim()
      out.push(`${jsxName}=${attrValue(value)}`)
    }
    if (isRoot) {
      if (options.dropSize && !parseViewBox(el.getAttribute('viewBox'))) out.push(`viewBox="0 0 ${info.width} ${info.height}"`)
      if (options.component && options.spreadProps) out.push('{...props}')
    }
    return out
  }

  function render(node: Node, depth: number, isRoot: boolean): string[] {
    const pad = INDENT.repeat(depth)
    if (node.nodeType === Node.COMMENT_NODE) {
      dropped.comments++
      return []
    }
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      const text = (node as CharacterData).data
      return text.trim() ? [pad + jsxText(text)] : []
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return []

    const el = node as Element
    if (DROP_TAGS.has(el.localName)) {
      if (el.localName === 'script') dropped.scripts++
      else dropped.metadata++
      return []
    }
    if (isForeignName(el.tagName)) {
      dropped.foreign++
      return []
    }

    const tag = el.tagName
    const list = attrs(el, isRoot)
    const oneLine = list.length ? ' ' + list.join(' ') : ''
    const open =
      (pad + '<' + tag + oneLine).length + 2 > MAX_LINE && list.length > 1
        ? [pad + '<' + tag, ...list.map((a) => pad + INDENT + a)]
        : [pad + '<' + tag + oneLine]
    const closeOpen = (end: string) => {
      const lines = [...open]
      lines[lines.length - 1] += lines.length > 1 ? '' : end
      if (lines.length > 1) lines.push(pad + end.trim())
      return lines
    }

    // A <style> sheet goes in as a template literal, so its braces are fine.
    if (tag === 'style') {
      const css = el.textContent ?? ''
      if (!css.trim()) return closeOpen(' />')
      const literal = '{`' + css.trim().replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`}'
      const lines = closeOpen('>')
      return [...lines, ...literal.split('\n').map((l) => pad + INDENT + l.trimEnd()), `${pad}</${tag}>`]
    }

    // Text elements stay on one line, so the spaces between words and tspans stay.
    if (KEEP_TEXT.has(el.localName)) {
      const inline = [...el.childNodes].map(inlineNode).join('')
      if (!inline) return closeOpen(' />')
      const lines = closeOpen('>')
      lines[lines.length - 1] += inline + `</${tag}>`
      return lines
    }

    const kids = [...el.childNodes].flatMap((k) => render(k, depth + 1, false))
    if (!kids.length) return closeOpen(' />')
    return [...closeOpen('>'), ...kids, `${pad}</${tag}>`]
  }

  // Inside text elements: everything on one line, text exactly as written.
  function inlineNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      const text = (node as CharacterData).data.replace(/\s*\n\s*/g, ' ')
      return text ? (/[{}<>]/.test(text) || /^\s|\s$|\s{2,}/.test(text) ? `{${JSON.stringify(text)}}` : text) : ''
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      dropped.comments++
      return ''
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const list = attrs(el, false)
    const inner = [...el.childNodes].map(inlineNode).join('')
    const head = `<${el.tagName}${list.length ? ' ' + list.join(' ') : ''}`
    return inner ? `${head}>${inner}</${el.tagName}>` : `${head} />`
  }

  let code: string
  if (options.component) {
    const body = render(svg, 2, true)
    const name = validName(options.name) ? options.name : componentName(options.name)
    const params = options.spreadProps ? (options.typescript ? 'props: SVGProps<SVGSVGElement>' : 'props') : ''
    const head = options.typescript && options.spreadProps ? "import type { SVGProps } from 'react'\n\n" : ''
    code = `${head}export default function ${name}(${params}) {\n  return (\n${body.join('\n')}\n  )\n}\n`
  } else {
    code = render(svg, 0, true).join('\n') + '\n'
  }

  const notes: string[] = []
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)
  if (dropped.scripts) notes.push(`Left out ${plural(dropped.scripts, 'a <script>', '<script>s')}; React won't run it.`)
  if (dropped.handlers) notes.push(`Left out ${plural(dropped.handlers, 'an event handler', 'event handlers')} (onclick and the like); add them as React props instead.`)
  if (dropped.foreign) notes.push('Left out editor attributes (Inkscape, Sodipodi, Illustrator…), which React can’t take.')
  if (dropped.comments || dropped.metadata) notes.push('Left out comments and <metadata>.')
  if (info.usesCurrentColor) notes.push('Uses currentColor, so it takes the text color where you place it.')
  if (svg.querySelector('[id]')) notes.push('Has ids: two copies on one page share them, so gradients or clips may point at the wrong copy.')
  return { code, notes }
}
