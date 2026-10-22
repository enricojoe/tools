import { Icon } from '../../components/Icon'
import type { NotifyPermission } from './alert'

interface NotifyPromptProps {
  permission: NotifyPermission
  onRequest: () => void
}

/** Lets people opt in to browser notifications and explains the other states. */
export function NotifyPrompt({ permission, onRequest }: NotifyPromptProps) {
  if (permission === 'default') {
    return (
      <div className="notify-prompt">
        <button type="button" className="btn btn-secondary" onClick={onRequest}>
          <Icon name="bell" size={18} />
          Turn on notifications
        </button>
        <p className="hint">Get a pop-up even when this tab is in the background.</p>
      </div>
    )
  }
  if (permission === 'denied') {
    return (
      <p className="hint">
        Notifications are blocked in your browser settings. The sound and the on-screen alert still work.
      </p>
    )
  }
  if (permission === 'unsupported') {
    return <p className="hint">This browser can't show notifications, but the sound and on-screen alert still work.</p>
  }
  return <p className="hint">Notifications are on.</p>
}
