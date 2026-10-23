/**
 * HTTP API Reference for AccessDrift F-02
 *
 * This file implements the frontend API signatures against the backend.
 * Copy this file to src/api/httpApi.ts to use it.
 *
 * Setup:
 * 1. Set VITE_API_MODE=http in your environment
 * 2. Set VITE_API_BASE_URL=http://localhost:8787 in your environment
 * 3. Export from src/api/index.ts: export { httpApi as api } from './httpApi'
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

export interface ApiError {
  type: string
  title: string
  status: number
  detail: string
}

export class ApiClient {
  private baseUrl: string
  private lastGoodDataAsOf: Map<string, string> = new Map()

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options: { headers?: Record<string, string>; params?: Record<string, string> } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value)
        }
      })
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
      headers['x-session-id'] = this.generateSessionId()
    }
    if (!headers['x-request-id']) {
      headers['x-request-id'] = this.generateRequestId()
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const dataAsOf = response.headers.get('x-data-as-of')
    if (dataAsOf) {
      this.lastGoodDataAsOf.set(path, dataAsOf)
    }

    if (!response.ok) {
      const error = await response.json() as ApiError
      throw new ApiErrorException(error)
    }

    return response.json()
  }

  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  private getLastGoodDataAsOf(path: string): string | null {
    return this.lastGoodDataAsOf.get(path) || null
  }

  // Health
  async getHealth() {
    return this.request('GET', '/api/health')
  }

  // Inventory
  async getInventory(params?: {
    userId?: string
    app?: string
    q?: string
    limit?: number
    offset?: number
  }) {
    return this.request('GET', '/api/inventory', undefined, { params })
  }

  // Grants
  async getGrants(params?: {
    userId?: string
    app?: string
    entitlementId?: string
    source?: string
    activeOn?: string
    removed?: boolean
    limit?: number
    offset?: number
  }) {
    return this.request('GET', '/api/grants', undefined, { params })
  }

  // Snapshots
  async getSnapshots(params?: {
    app?: string
    from?: string
    to?: string
    complete?: boolean
    limit?: number
    offset?: number
  }) {
    return this.request('GET', '/api/snapshots', undefined, { params })
  }

  // Access As-Of
  async getAccessAsOf(userId: string, date: string) {
    return this.request('GET', '/api/access-as-of', undefined, {
      params: { userId, date },
    })
  }

  // Diff
  async diffSnapshots(userId: string, a: string, b: string, app?: string) {
    return this.request('GET', '/api/diff', undefined, {
      params: { userId, a, b, app },
    })
  }

  // Coverage
  async getSnapshotCoverage() {
    return this.request('GET', '/api/snapshot-coverage')
  }

  // Before-After
  async getBeforeAfter(userId: string, eventDate?: string) {
    return this.request('GET', '/api/before-after', undefined, {
      params: { userId, eventDate },
    })
  }

  // Sync Runs
  async getSyncRuns(app?: string) {
    return this.request('GET', '/api/sync-runs', undefined, { params: { app } })
  }

  // Schedule
  async getSchedule() {
    return this.request('GET', '/api/schedule')
  }

  async updateSchedule(
    app: string,
    frequency: 'daily' | 'weekly' | 'manual',
    enabled: boolean,
    actorId: string
  ) {
    return this.request('PUT', `/api/schedule/${app}`, {
      frequency,
      enabled,
      actorId,
    })
  }

  // Sync Simulate
  async syncSimulate(app: string, withChange: boolean, actorId: string) {
    return this.request('POST', '/api/sync/simulate', {
      app,
      withChange,
      actorId,
    })
  }

  // Replay Check
  async runReplayCheck(snapshotId?: string) {
    return this.request('POST', '/api/replay-check', { snapshotId })
  }

  // Evidence
  async getEvidence(id: string) {
    return this.request('GET', `/api/evidence/${id}`)
  }

  // Audit
  async listAudit(params?: {
    actorId?: string
    action?: string
    targetType?: string
    from?: string
    to?: string
    q?: string
    limit?: number
    offset?: number
  }) {
    return this.request('GET', '/api/audit', undefined, { params })
  }

  async recordAuditEvent(event: {
    id?: string
    actorId: string
    action: string
    targetType: string
    targetId: string
    detail: string
  }) {
    return this.request('POST', '/api/audit/event', event)
  }

  // Findings
  async createManualFinding(params: {
    userId: string
    entitlementId: string
    grantId?: string
    actorId: string
  }) {
    return this.request('POST', '/api/findings/manual', params)
  }

  async getManualFindings() {
    return this.request('GET', '/api/findings/manual')
  }

  // Export
  async exportDiffCsv(userId: string, a: string, b: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/export/diff.csv?userId=${encodeURIComponent(userId)}&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
      {
        headers: {
          'x-actor-id': 'rev-asha',
          'x-session-id': this.generateSessionId(),
          'x-request-id': this.generateRequestId(),
        },
      }
    )

    if (!response.ok) {
      const error = await response.json() as ApiError
      throw new ApiErrorException(error)
    }

    return response.text()
  }

  // Drift Summary
  async getDriftSummary(userId: string, from: string, to: string, showNames: boolean = false) {
    return this.request('POST', '/api/drift-summary', {
      userId,
      from,
      to,
      showNames,
    })
  }

  // Dev Flags (non-production only)
  async setDevFlags(flags: {
    corruptSnapshotId?: string | null
    simulateConnectorError?: Partial<Record<string, boolean>>
    simulateShortLogs?: boolean
  }) {
    return this.request('POST', '/api/dev/flags', flags)
  }

  async resetDev() {
    return this.request('POST', '/api/dev/reset')
  }

  // Functions not covered by backend - delegate to staticApi
  // These should import from src/api/staticApi.ts instead:
  // - getFindings, getFinding, decide, undo, assign, comment, createHandoff
  // - getExplanation, verifyAudit
  // - getHandoffs, getActivity, getUsers, getEntitlements, getPeerGroups, getRoleChanges, getSettings, getConnectors
  // - revokeConsent, restoreConsent
}

export class ApiErrorException extends Error {
  public error: ApiError

  constructor(error: ApiError) {
    super(error.detail)
    this.name = 'ApiErrorException'
    this.error = error
  }
}

// Singleton instance
export const httpApi = new ApiClient()
