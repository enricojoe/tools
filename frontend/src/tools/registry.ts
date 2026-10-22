import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { IconName } from '../components/Icon'

export interface Tool {
  /** URL segment: the tool lives at `/tools/:slug`. */
  slug: string
  name: string
  description: string
  category: string
  icon: IconName
  /** Extra search terms that are not in the name or description. */
  keywords: string[]
  Component: LazyExoticComponent<ComponentType>
}

/**
 * Every tool in the app. Adding a tool means adding an entry here and its
 * page under `src/tools/<slug>/`; navigation, search and routing pick it up.
 */
export const TOOLS: Tool[] = [
  {
    slug: 'qr-code',
    name: 'QR Code Generator',
    description: 'Turn any text or URL into a downloadable QR code.',
    category: 'Generators',
    icon: 'qr',
    keywords: ['qr', 'barcode', 'link', 'png'],
    Component: lazy(() => import('./qr/QRTool')),
  },
  {
    slug: 'qr-reader',
    name: 'QR Code Reader',
    description: 'Scan a QR code from an image or your camera and read what it says.',
    category: 'Readers',
    icon: 'scan',
    keywords: ['qr', 'scan', 'decode', 'camera', 'barcode', 'upload'],
    Component: lazy(() => import('./qr-reader/QRReaderTool')),
  },
]

export function findTool(slug: string | undefined): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

/** Tools whose name, description, category or keywords contain every word of the query. */
export function searchTools(query: string): Tool[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return TOOLS
  return TOOLS.filter((t) => {
    const haystack = [t.name, t.description, t.category, ...t.keywords]
      .join(' ')
      .toLowerCase()
    return words.every((w) => haystack.includes(w))
  })
}

/** Groups tools by category, keeping registry order. */
export function groupByCategory(tools: Tool[]): [string, Tool[]][] {
  const groups = new Map<string, Tool[]>()
  for (const t of tools) {
    groups.set(t.category, [...(groups.get(t.category) ?? []), t])
  }
  return [...groups]
}
