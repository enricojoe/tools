// Small helpers the viewer and Compare share.

import { useEffect, useRef, type CSSProperties } from 'react'

export const EXAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <!-- A sunny sticker -->
  <circle cx="60" cy="60" r="54" fill="#e6eeff" stroke="#172033" stroke-width="4"/>
  <path d="M60 14v10M60 96v10M14 60h10M96 60h10M27 27l7 7M86 86l7 7M93 27l-7 7M34 86l-7 7"
    stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>
  <circle cx="60" cy="60" r="24" fill="#1d4ed8" stroke="#172033" stroke-width="4"/>
  <circle cx="52" cy="56" r="3" fill="#fff"/>
  <circle cx="68" cy="56" r="3" fill="#fff"/>
  <path d="M51 66q9 8 18 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>
`

// Drafts past this size aren't saved, so one huge paste can't fill storage.
export const MAX_DRAFT = 500_000
export const SAVE_DELAY_MS = 300

export type Background = 'checker' | 'white' | 'black' | 'custom'

export const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: 'checker', label: 'Checker' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'custom', label: 'Color' },
]

/** The solid color for a background; white stands in for the checkerboard. */
export function solidColor(background: Background, custom: string): string {
  return background === 'black' ? '#000000' : background === 'custom' ? custom : '#ffffff'
}

/** Class and style for a stage with this background. */
export function stageLook(background: Background, custom: string): { className: string; style?: CSSProperties } {
  return background === 'checker'
    ? { className: ' svgv-checker' }
    : { className: '', style: { background: solidColor(background, custom) } }
}

export function download(data: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Give the browser a moment to start the download before letting go.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable or full: the choice just won't survive a reload.
  }
}

/** Whether pasted text looks like SVG code worth opening. */
export function looksLikeSvg(text: string): boolean {
  return /<svg[\s>]/i.test(text)
}

/**
 * Paste anywhere on the page (outside text fields) to open SVG code or an
 * .svg file. `onPaste` gets the text, or the file to read.
 */
export function useWindowPaste(onPaste: (pasted: { text: string } | { file: File }) => void): void {
  const handler = useRef(onPaste)
  useEffect(() => {
    handler.current = onPaste
  })
  useEffect(() => {
    function listen(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const file = e.clipboardData?.files[0]
      if (looksLikeSvg(text)) handler.current({ text })
      else if (file) handler.current({ file })
      else return
      e.preventDefault()
    }
    window.addEventListener('paste', listen)
    return () => window.removeEventListener('paste', listen)
  }, [])
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
