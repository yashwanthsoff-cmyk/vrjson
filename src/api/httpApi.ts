import type { ApiError, Finding, AuditEvent } from '../types/contract'
import { mapApiError } from './errors'
import { staticApi } from './staticApi'

// Use Vite proxy for API calls in development (no CORS issues)
// In production, this will need to be set to the actual backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Generate and persist session ID across the session
let sessionId: string | null = null
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
  return sessionId
}

// In-memory last-good cache
const lastGoodCache = new Map<string, { data: any; timestamp: number; dataAsOf: string }>()

async function request<T>(
  method: string,
  path: string,
  body?: any,
  options: { headers?: Record<string, string>; params?: Record<string, string | number | boolean> } = {}
): Promise<T> {
  // Build URL - handle relative paths for Vite proxy (empty API_BASE_URL)
  let url: string
  if (API_BASE_URL) {
    const urlObj = new URL(path, API_BASE_URL)
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlObj.searchParams.append(key, String(value))
        }
      })
    }
    url = urlObj.toString()
  } else {
    // Relative path for Vite proxy
    url = path
    if (options.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Add actor-id, session-id, request-id headers
  if (!headers['x-actor-id']) {
    headers['x-actor-id'] = 'rev-asha' // Default to Asha Rao
  }
  if (!headers['x-session-id']) {
    headers['x-session-id'] = getSessionId()
  }
  if (!headers['x-request-id']) {
    headers['x-request-id'] = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  // Generate cache key
  const cacheKey = `${method}:${path}:${JSON.stringify(options.params || {})}`

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const dataAsOf = response.headers.get('x-data-as-of')

    if (!response.ok) {
      // Try to return last good data on 5xx errors
      if (response.status >= 500 && lastGoodCache.has(cacheKey)) {
        const cached = lastGoodCache.get(cacheKey)!
        console.warn(`Using last good data for ${path} (status ${response.status})`)
        return cached.data as T
      }

      const errorData = await response.json().catch(() => ({ type: 'unknown', title: 'Request failed', status: response.status, detail: response.statusText }))
      throw mapApiError(new Error(`${response.status}: ${errorData.detail || errorData.title || 'Unknown error'}`))
    }

    const data = await response.json()

    // Cache successful responses
    if (dataAsOf) {
      lastGoodCache.set(cacheKey, { data, timestamp: Date.now(), dataAsOf })
    }

    return data as T
  } catch (error) {
    // Return last good data on network errors
    if (error instanceof TypeError && lastGoodCache.has(cacheKey)) {
      const cached = lastGoodCache.get(cacheKey)!
      console.warn(`Using last good data for ${path} (network error)`)
      return cached.data as T
    }
    throw mapApiError(error)
  }
}

// Helper to extract items from paginated responses
function extractItems<T>(response: { items: T[]; total: number }): T[] {
  return response.items
}

export function createHttpApi() {
  return {
    // Basic API methods (from local HEAD)
    getFindings: () => request<{ items: Finding[]; total: number }>('/api/findings').then(extractItems),
    getFinding: (id: string) => request<Finding>(`/api/findings/${id}`),
    decide: (id: string, decision: string) => request<{ finding: Finding; event: unknown }>(`/api/findings/${id}/decisions`, { method: 'POST', body: { decision } }),
    undo: (id: string) => request<unknown>(`/api/decisions/${id}/undo`, { method: 'POST' }),
    assign: (id: string, ownerId: string, dueDate: string) => request<Finding>(`/api/findings/${id}`, { method: 'PATCH', body: { ownerId, dueDate } }),
    comment: (id: string, note: string) => request<unknown>(`/api/findings/${id}/comments`, { method: 'POST', body: { note } }),
    createHandoff: (id: string, decision: 'approve_revoke' | 'approve_downgrade') => request<unknown>(`/api/findings/${id}/decisions`, { method: 'POST', body: { decision } }),
    getAudit: () => request<AuditEvent[]>('/api/audit'),
    getEvidence: () => request<{ items: unknown[]; total: number }>('/api/evidence').then(extractItems),
    getExplanation: (id: string) => request<unknown>(`/api/findings/${id}/explanation`),
    verifyAudit: () => request<{ passed: number; brokenAt: string | null }>('/api/audit/verify', { method: 'POST' }),
    replay: (id?: string) => request<{ passed: number; failed: number; skipped: number; failedSnapshotId: string | null }>('/api/replay-check', { method: 'POST', body: { snapshotId: id } }),
    corruptSnapshot: (id: string) => request<unknown>(`/api/snapshots/${id}/corrupt`, { method: 'POST' }),
    sync: (app: string) => request<{ status: string; added: number; removed: number; note: string }>('/api/connectors/sync', { method: 'POST', body: { app } }),
    getHandoffs: () => request<unknown[]>('/api/handoffs'),
    getActivity: () => request<unknown[]>('/api/activity'),
    getUsers: () => request<unknown[]>('/api/users'),
    getEntitlements: () => request<unknown[]>('/api/entitlements'),
    getPeerGroups: () => request<unknown[]>('/api/peer-groups'),
    getRoleChanges: () => request<unknown[]>('/api/role-changes'),
    getSettings: () => request<unknown>('/api/settings'),
    getConnectors: () => request<{ items: unknown[]; total: number }>('/api/connectors').then(extractItems),
    revokeConsent: (app: string) => request<unknown>(`/api/connectors/${encodeURIComponent(app)}/consent`, { method: 'DELETE' }),
    restoreConsent: (app: string) => request<unknown>(`/api/connectors/${encodeURIComponent(app)}/consent`, { method: 'POST' }),

    // F-02 HTTP API functions (from remote)
    getInventory: (params?: { userId?: string; app?: string; q?: string; limit?: number; offset?: number }) =>
      request('GET', '/api/inventory', undefined, { params }),

    getGrants: (params?: { userId?: string; app?: string; entitlementId?: string; source?: string; activeOn?: string; removed?: boolean; limit?: number; offset?: number }) =>
      request('GET', '/api/grants', undefined, { params }),

    getSnapshots: (params?: { app?: string; from?: string; to?: string; complete?: boolean; limit?: number; offset?: number }) =>
      request('GET', '/api/snapshots', undefined, { params }),

    getAccessAsOf: (userId: string, date: string) =>
      request('GET', '/api/access-as-of', undefined, { params: { userId, date } }),

    diffSnapshots: (userId: string, a: string, b: string, app?: string) =>
      request('GET', '/api/diff', undefined, { params: app ? { userId, a, b, app } : { userId, a, b } }),

    getSnapshotCoverage: () =>
      request('GET', '/api/snapshot-coverage'),

    getBeforeAfter: (userId: string, eventDate?: string) =>
      request('GET', '/api/before-after', undefined, { params: eventDate ? { userId, eventDate } : { userId } }),

    getSyncRuns: (app?: string) =>
      request('GET', '/api/sync-runs', undefined, { params: app ? { app } : undefined }),

    getSchedule: () =>
      request('GET', '/api/schedule'),

    setSchedule: (app: string, frequency: 'daily' | 'weekly' | 'manual', enabled: boolean, actorId: string) =>
      request('PUT', `/api/schedule/${app}`, { frequency, enabled, actorId }),

    runSync: (app: string, withChange: boolean, actorId: string) =>
      request('POST', '/api/sync/simulate', { app, withChange, actorId }),

    runReplayCheck: (snapshotId?: string) =>
      request('POST', '/api/replay-check', { snapshotId }),

    listAudit: (params?: { actorId?: string; action?: string; targetType?: string; from?: string; to?: string; q?: string; limit?: number; offset?: number }) =>
      request('GET', '/api/audit', undefined, { params }),

    getEvidenceById: (id: string) =>
      request('GET', `/api/evidence/${id}`),

    flagManual: (userId: string, entitlementId: string, actorId: string, grantId?: string) =>
      request('POST', '/api/findings/manual', { userId, entitlementId, grantId, actorId }),

    getManualFindings: () =>
      request('GET', '/api/findings/manual'),

    exportDiffCsv: (userId: string, a: string, b: string) => {
      const baseUrl = API_BASE_URL || ''
      const url = `${baseUrl}/api/export/diff.csv?userId=${encodeURIComponent(userId)}&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
      return fetch(url, {
        headers: {
          'x-actor-id': 'rev-asha',
          'x-session-id': getSessionId(),
          'x-request-id': `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        },
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
    },

    getDriftSummary: (userId: string, from: string, to: string, showNames: boolean = false) =>
      request('POST', '/api/drift-summary', { userId, from, to, showNames }),

    setDevFlags: (flags: { corruptSnapshotId?: string | null; simulateConnectorError?: Partial<Record<string, boolean>>; simulateShortLogs?: boolean }) =>
      request('POST', '/api/dev/flags', flags),

    resetDev: () =>
      request('POST', '/api/dev/reset'),

    // Delegate all other functions to staticApi (excluding the ones we override)
    ...((({ getSnapshots, getEvidence, getDriftSummary, setDevFlags, resetDev, ...rest }) => rest)(staticApi)),
  }
}
