/** An API failure: carries the backend's message plus the HTTP status. */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Builds an ApiError from a failed response, using the backend's `{error}` message when present. */
export async function toApiError(res: Response): Promise<ApiError> {
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
  return new ApiError(message, res.status)
}
