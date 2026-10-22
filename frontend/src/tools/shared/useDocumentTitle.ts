import { useEffect, useRef } from 'react'

/** Puts `text` in the tab title while non-null, and restores the original after. */
export function useDocumentTitle(text: string | null): void {
  const original = useRef<string | null>(null)

  useEffect(() => {
    if (text !== null) {
      original.current ??= document.title
      document.title = text
    } else if (original.current !== null) {
      document.title = original.current
      original.current = null
    }
  }, [text])

  useEffect(
    () => () => {
      if (original.current !== null) document.title = original.current
    },
    [],
  )
}
