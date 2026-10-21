import { useCallback, useEffect, useRef, useState } from 'react'
import { generateQR, type QRRequest } from './api/qr'
import { QRForm } from './components/QRForm'
import { QRPreview } from './components/QRPreview'
import './App.css'

interface Result {
  url: string
  size: number
}

export default function App() {
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
    <main className="page">
      <h1>QR Code Generator</h1>
      <p className="lead">Turn any text or URL into a downloadable QR code.</p>

      <QRForm loading={loading} onSubmit={handleSubmit} />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result && <QRPreview url={result.url} size={result.size} />}
    </main>
  )
}
