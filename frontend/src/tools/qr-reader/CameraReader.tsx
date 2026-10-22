import { useEffect, useRef, useState } from 'react'
import { decodeQR, NO_QR_FOUND, ApiError } from '../../api/qr'

const SCAN_INTERVAL_MS = 500
const MAX_SIDE = 1024

interface CameraReaderProps {
  onResult: (content: string) => void
}

/** Maps getUserMedia failures to something a person can act on. */
function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in your browser settings, then try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera found on this device. Try uploading an image instead.'
    case 'NotReadableError':
      return 'The camera is busy in another app. Close it and try again.'
    default:
      return "Couldn't start the camera. Try again, or upload an image instead."
  }
}

function canUseCamera(): boolean {
  return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia
}

export function CameraReader({ onResult }: CameraReaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(
    canUseCamera()
      ? null
      : 'The camera needs a secure page (HTTPS or localhost) and a browser that supports it. Try uploading an image instead.',
  )
  const [ready, setReady] = useState(false)
  // Bumped by "Try again" to re-run the effect.
  const [attempt, setAttempt] = useState(0)
  // Kept fresh so the long-lived scan loop never calls a stale callback.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    if (!canUseCamera()) return

    let cancelled = false
    let stream: MediaStream | null = null
    let timer: number | undefined
    let inFlight = false
    const controller = new AbortController()
    const canvas = document.createElement('canvas')

    function stop() {
      cancelled = true
      window.clearInterval(timer)
      controller.abort()
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }

    function grabFrame(video: HTMLVideoElement): Promise<Blob | null> {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    }

    async function scan(video: HTMLVideoElement) {
      // Only one request at a time; skip frames until the video has data.
      if (inFlight || cancelled || video.videoWidth === 0) return
      inFlight = true
      try {
        const frame = await grabFrame(video)
        if (!frame || cancelled) return
        const content = await decodeQR(frame, controller.signal)
        if (cancelled) return
        stop()
        onResultRef.current(content)
      } catch (err) {
        if (cancelled) return
        // 422 just means no code in this frame: keep scanning.
        if (err instanceof ApiError && err.status === NO_QR_FOUND) return
        stop()
        setReady(false)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        inFlight = false
      }
    }

    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream = media
        const video = videoRef.current
        if (!video) return
        video.srcObject = media
        await video.play()
        if (cancelled) return
        setReady(true)
        timer = window.setInterval(() => void scan(video), SCAN_INTERVAL_MS)
      } catch (err) {
        if (cancelled) return
        stop()
        setError(cameraErrorMessage(err))
      }
    }

    void start()
    return stop
  }, [attempt])

  return (
    <div className="card reader-card">
      {!error && (
        <div className="camera">
          <video ref={videoRef} className="camera-video" muted playsInline />
          <div className="scan-frame" aria-hidden="true" />
        </div>
      )}
      {!error && (
        <p className="hint" role="status">
          {ready
            ? 'Point your camera at a QR code. It scans on its own.'
            : 'Starting the camera…'}
        </p>
      )}
      {error && (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          {canUseCamera() && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setError(null)
                setAttempt((n) => n + 1)
              }}
            >
              Try again
            </button>
          )}
        </>
      )}
    </div>
  )
}
