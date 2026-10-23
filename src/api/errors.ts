import type { ApiError } from '../types/contract'

export function mapApiError(error: unknown): ApiError {
  if (error instanceof TypeError) return { code: 'unavailable', message: 'Data is temporarily unavailable. Last good data is kept.' }
  if (error instanceof Error && error.message.includes('409')) return { code: 'conflict', message: 'This item changed. Reload to see the latest.' }
  if (error instanceof Error && error.message.includes('403')) return { code: 'forbidden', message: 'Requires the appropriate role.' }
  if (error instanceof Error && error.message.includes('404')) return { code: 'not_found', message: 'The requested record was not found.' }
  return { code: 'unknown', message: error instanceof Error ? error.message : 'Unknown API error.' }
}
