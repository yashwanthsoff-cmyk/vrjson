import type { ApiProblem } from './types/extra.js'

export class ApiError extends Error {
  constructor(
    public type: string,
    public status: number,
    public title: string,
    public detail: string
  ) {
    super(detail)
    this.name = 'ApiError'
  }

  toProblem(): ApiProblem {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    }
  }
}

export const problems = {
  badRequest: (detail: string) => new ApiError('bad_request', 400, 'Bad Request', detail),
  validation: (detail: string) => new ApiError('validation', 400, 'Validation Error', detail),
  notFound: (detail: string) => new ApiError('not_found', 404, 'Not Found', detail),
  conflict: (detail: string) => new ApiError('conflict', 409, 'Conflict', detail),
  forbidden: (detail: string) => new ApiError('forbidden', 403, 'Forbidden', detail),
  rateLimited: (detail: string) => new ApiError('rate_limited', 429, 'Rate Limited', detail),
  serviceUnavailable: (detail: string) => new ApiError('unavailable', 503, 'Service Unavailable', detail),
  unavailable: (detail: string) => new ApiError('unavailable', 503, 'Service Unavailable', detail),
  internal: (detail: string = 'An internal error occurred') => new ApiError('internal', 500, 'Internal Server Error', detail),
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
