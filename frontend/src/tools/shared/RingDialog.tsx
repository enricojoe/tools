import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'

interface RingDialogProps {
  title: string
  /** Called when the dialog is closed with Escape. */
  onEscape: () => void
  children: ReactNode
}

/**
 * Modal "it's ringing" alert. Uses the native <dialog> so focus is trapped and
 * restored; announced to screen readers as an alert dialog.
 */
export function RingDialog({ title, onEscape, children }: RingDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="ring-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onEscape()
      }}
    >
      <div className="ring-bell">
        <Icon name="bell" size={40} />
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}
