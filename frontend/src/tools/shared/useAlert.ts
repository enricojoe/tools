import { useCallback, useEffect, useState } from 'react'
import { getNotifyPermission, startAlertSound, type NotifyPermission } from './alert'

/** Plays the repeating beep while `active` is true. */
export function useAlertSound(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return startAlertSound()
  }, [active])
}

export function useNotifyPermission() {
  const [permission, setPermission] = useState<NotifyPermission>(getNotifyPermission)

  const request = useCallback(async () => {
    if (permission === 'unsupported') return
    try {
      setPermission(await Notification.requestPermission())
    } catch {
      setPermission(getNotifyPermission())
    }
  }, [permission])

  return { permission, request }
}
