import { useEffect, useRef, useState, type DragEvent } from 'react'
import { decodeQR } from '../../api/qr'
import { Icon } from '../../components/Icon'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif']

interface UploadReaderProps {
  onResult: (content: string) => void
}

/** Returns a friendly message if the file can't be sent, or null if it's fine. */
function validate(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'That file is not a PNG, JPEG or GIF image. Try another one.'
  }
  if (file.size > MAX_BYTES) return 'That image is over 10 MB. Try a smaller one.'
  return null
}

export function UploadReader({ onResult }: UploadReaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Revoke the preview URL and cancel any in-flight request on unmount.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  async function handleFile(file: File) {
    abortRef.current?.abort()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setPreviewUrl(null)

    const problem = validate(file)
    if (problem) {
      setError(problem)
      return
    }

    urlRef.current = URL.createObjectURL(file)
    setPreviewUrl(urlRef.current)

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      onResult(await decodeQR(file, controller.signal))
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <div className="card reader-card" aria-busy={loading}>
      <label
        className={dragging ? 'dropzone dropzone-active' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            // Allow picking the same file again after an error.
            e.target.value = ''
          }}
        />
        {previewUrl ? (
          <img src={previewUrl} alt="Selected image preview" className="upload-preview" />
        ) : (
          <>
            <Icon name="upload" size={44} />
            <span className="dropzone-title">Drop an image here</span>
            <span className="hint">or click to pick one (PNG, JPEG or GIF, up to 10 MB)</span>
          </>
        )}
      </label>

      {loading && (
        <p className="hint" role="status">
          Reading your QR code…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
