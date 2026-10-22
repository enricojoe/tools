import { toApiError } from './client'

export { ApiError } from './client'

export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

export interface QRRequest {
  content: string
  size: number
  level: ErrorLevel
}

/** Requests a QR code PNG from the backend. Throws an Error carrying the backend's message on failure. */
export async function generateQR(
  request: QRRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch('/api/qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!res.ok) throw await toApiError(res)

  return res.blob()
}

/** Status the backend uses for "no QR code found in image". */
export const NO_QR_FOUND = 422

/** Sends an image to the backend and returns the decoded text. Throws an ApiError on failure. */
export async function decodeQR(
  image: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData()
  form.append('image', image)

  const res = await fetch('/api/qr/decode', {
    method: 'POST',
    body: form,
    signal,
  })
  if (!res.ok) throw await toApiError(res)

  const body: { content: string } = await res.json()
  return body.content
}
