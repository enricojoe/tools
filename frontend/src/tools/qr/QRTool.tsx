import { useCallback, useEffect, useRef, useState } from 'react'
import { generateQR, type QRRequest } from '../../api/qr'
import { QRForm } from './QRForm'
import { QRPreview } from './QRPreview'
import './QRTool.css'

interface Result {
  url: string
  size: number
}

export default function QRTool() {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  // Revoke the object URL and cancel any in-flight request on unmount.
  useEffect(
    () => () => {
      revoke()
      abortRef.current?.abort()
    },
    [revoke],
  )

  async function handleSubmit(request: QRRequest) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const blob = await generateQR(request, controller.signal)
      revoke()
      urlRef.current = URL.createObjectURL(blob)
      setResult({ url: urlRef.current, size: Math.min(request.size, 512) })
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  return (
    <div className="qr-tool">
      <QRForm loading={loading} onSubmit={handleSubmit} />
      <div className="qr-output">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <QRPreview result={result} loading={loading} />
      </div>
    </div>
  )
}
