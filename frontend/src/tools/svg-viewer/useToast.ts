import { useEffect, useRef, useState } from 'react'

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastState {
  id: number
  message: string
  action?: ToastAction
  error?: boolean
}

const SHOW_MS = 2200
const SHOW_WITH_ACTION_MS = 6000

/** One short message at a time, gone after a moment (longer when it offers an action). */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function show(message: string, extra: { action?: ToastAction; error?: boolean } = {}) {
    const { action, error } = extra
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), message, action, error })
    timer.current = window.setTimeout(() => setToast(null), action ? SHOW_WITH_ACTION_MS : SHOW_MS)
  }

  function hide() {
    window.clearTimeout(timer.current)
    setToast(null)
  }

  return { toast, show, hide }
}
