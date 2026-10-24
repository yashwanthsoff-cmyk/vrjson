import type { AuditEvent, Finding } from '../data'

// Use Vite proxy for API calls in development (no CORS issues)
// In production, this will need to be set to the actual backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

// Helper to extract items from paginated responses
function extractItems<T>(response: { items: T[]; total: number }): T[] {
  return response.items
}

export function createHttpApi() {
  return {
    getFindings: () => request<{ items: Finding[]; total: number }>('/api/findings').then(extractItems),
    getFinding: (id: string) => request<Finding>(`/api/findings/${id}`),
    decide: (id: string, decision: string) => request<{ finding: Finding; event: unknown }>(`/api/findings/${id}/decisions`, { method: 'POST', body: JSON.stringify({ decision }) }),
    undo: (id: string) => request<unknown>(`/api/decisions/${id}/undo`, { method: 'POST' }),
    assign: (id: string, ownerId: string, dueDate: string) => request<Finding>(`/api/findings/${id}`, { method: 'PATCH', body: JSON.stringify({ ownerId, dueDate }) }),
    comment: (id: string, note: string) => request<unknown>(`/api/findings/${id}/comments`, { method: 'POST', body: JSON.stringify({ note }) }),
    createHandoff: (id: string, decision: 'approve_revoke' | 'approve_downgrade') => request<unknown>(`/api/findings/${id}/decisions`, { method: 'POST', body: JSON.stringify({ decision }) }),
    getAudit: () => request<AuditEvent[]>('/api/audit'),
    getEvidence: () => request<{ items: unknown[]; total: number }>('/api/evidence').then(extractItems),
    getExplanation: (id: string) => request<unknown>(`/api/findings/${id}/explanation`),
    verifyAudit: () => request<{ passed: number; brokenAt: string | null }>('/api/audit/verify', { method: 'POST' }),
    replay: (id?: string) => request<{ passed: number; failed: number; skipped: number; failedSnapshotId: string | null }>('/api/replay-check', { method: 'POST', body: JSON.stringify({ snapshotId: id }) }),
    corruptSnapshot: (id: string) => request<unknown>(`/api/snapshots/${id}/corrupt`, { method: 'POST' }),
    sync: (app: string) => request<{ status: string; added: number; removed: number; note: string }>('/api/connectors/sync', { method: 'POST', body: JSON.stringify({ app }) }),
    getHandoffs: () => request<unknown[]>('/api/handoffs'),
    getActivity: () => request<unknown[]>('/api/activity'),
    getSnapshots: () => request<unknown[]>('/api/snapshots'),
    getUsers: () => request<unknown[]>('/api/users'),
    getEntitlements: () => request<unknown[]>('/api/entitlements'),
    getPeerGroups: () => request<unknown[]>('/api/peer-groups'),
    getRoleChanges: () => request<unknown[]>('/api/role-changes'),
    getSettings: () => request<unknown>('/api/settings'),
    getConnectors: () => request<{ items: unknown[]; total: number }>('/api/connectors').then(extractItems),
    revokeConsent: (app: string) => request<unknown>(`/api/connectors/${encodeURIComponent(app)}/consent`, { method: 'DELETE' }),
    restoreConsent: (app: string) => request<unknown>(`/api/connectors/${encodeURIComponent(app)}/consent`, { method: 'POST' }),
  }
}
