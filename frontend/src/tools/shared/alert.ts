// Beep + browser notification, shared by the alarm and the timer.

const SOUND_CAP_MS = 60_000

let audio: AudioContext | null = null

function getAudio(): AudioContext | null {
  if (audio) return audio
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  audio = new Ctor()
  return audio
}

/** Call from a click handler: browsers only let audio start after a user gesture. */
export function unlockAudio(): void {
  void getAudio()?.resume().catch(() => {})
}

function tone(ctx: AudioContext, start: number, seconds: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.25, start + 0.02)
  gain.gain.linearRampToValueAtTime(0, start + seconds)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + seconds + 0.05)
}

/** Starts a repeating double beep (stops itself after a minute). Returns a stop function. */
export function startAlertSound(): () => void {
  const ctx = getAudio()
  if (!ctx) return () => {}
  void ctx.resume().catch(() => {})

  const play = () => {
    const t = ctx.currentTime
    tone(ctx, t, 0.15)
    tone(ctx, t + 0.25, 0.15)
  }
  play()
  const interval = setInterval(play, 1000)
  const cap = setTimeout(() => clearInterval(interval), SOUND_CAP_MS)
  return () => {
    clearInterval(interval)
    clearTimeout(cap)
  }
}

export type NotifyPermission = NotificationPermission | 'unsupported'

export function getNotifyPermission(): NotifyPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Shows a browser notification if the user allowed them; otherwise does nothing. */
export function notify(title: string, body: string, tag: string): void {
  if (getNotifyPermission() !== 'granted') return
  try {
    new Notification(title, { body, tag, requireInteraction: true })
  } catch {
    // Some mobile browsers only allow notifications through a service worker.
  }
}
