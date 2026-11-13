import { useEffect } from 'react'
import { iconPath } from '../components/iconPaths'
import { categoryColor, type Tool } from '../tools/registry'

const DEFAULT_FAVICON = '/favicon.svg'

/** A tilted sticker tile in the tool's category color with its icon in white. */
function toolFavicon(tool: Tool): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<g transform="rotate(-6 32 32)">
<rect x="9" y="11" width="48" height="48" rx="14" fill="#172033"/>
<rect x="5" y="6" width="48" height="48" rx="14" fill="${categoryColor(tool.category).light}" stroke="#172033" stroke-width="4"/>
<path transform="translate(11 12) scale(1.5)" d="${iconPath(tool.icon)}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</g></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Shows the open tool's icon in the browser tab, and the app icon everywhere else. */
export function useToolFavicon(tool: Tool | undefined) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return
    link.href = tool ? toolFavicon(tool) : DEFAULT_FAVICON
  }, [tool])
}
