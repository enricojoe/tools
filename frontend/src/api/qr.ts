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

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body: unknown = await res.json()
      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
      ) {
        message = body.error
      }
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new Error(message)
  }

  return res.blob()
}
