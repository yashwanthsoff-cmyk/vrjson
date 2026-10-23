import type { AuditEvent, Finding } from '../data'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export function createHttpApi() {
  return {
    getFindings: () => request<Finding[]>('/api/findings'),
    getFinding: (id: string) => request<Finding>(`/api/findings/${id}`),
    decide: (id: string, decision: string) => request<{ finding: Finding; event: unknown }>(`/api/findings/${id}/decisions`, { method: 'POST', body: JSON.stringify({ decision }) }),
    undo: (id: string) => request<unknown>(`/api/decisions/${id}/undo`, { method: 'POST' }),
    assign: (id: string, ownerId: string, dueDate: string) => request<Finding>(`/api/findings/${id}`, { method: 'PATCH', body: JSON.stringify({ ownerId, dueDate }) }),
    comment: (id: string, note: string) => request<unknown>(`/api/findings/${id}/comments`, { method: 'POST', body: JSON.stringify({ note }) }),
    createHandoff: (id: string, decision: 'approve_revoke' | 'approve_downgrade') => request<unknown>(`/api/findings/${id}/decisions`, { method: 'POST', body: JSON.stringify({ decision }) }),
    getAudit: () => request<AuditEvent[]>('/api/audit'),
    getEvidence: () => request<unknown[]>('/api/evidence'),
    getExplanation: (id: string) => request<unknown>(`/api/findings/${id}/explanation`),
    verifyAudit: () => request<{ passed: number; brokenAt: string | null }>('/api/audit/verify', { method: 'POST' }),
    replay: (id?: string) => request<{ passed: number; failed: number; skipped: number }>('/api/replay-check', { method: 'POST', body: JSON.stringify({ snapshotId: id }) }),
    sync: (app: string) => request<{ status: string; added: number; removed: number; note: string }>('/api/connectors/sync', { method: 'POST', body: JSON.stringify({ app }) }),
    getHandoffs: () => request<unknown[]>('/api/handoffs'),
    getActivity: () => request<unknown[]>('/api/activity'),
    getSnapshots: () => request<unknown[]>('/api/snapshots'),
    getUsers: () => request<unknown[]>('/api/users'),
    getEntitlements: () => request<unknown[]>('/api/entitlements'),
    getPeerGroups: () => request<unknown[]>('/api/peer-groups'),
    getRoleChanges: () => request<unknown[]>('/api/role-changes'),
    getSettings: () => request<unknown>('/api/settings'),
    getConnectors: () => request<unknown[]>('/api/connectors'),
  }
}
