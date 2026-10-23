/**
 * docs/httpApi.f03.reference.ts
 * Copy-ready reference implementation for frontend integration.
 * DO NOT copy directly into src/ until ready.
 */

import type {
  ActivityRow,
  MappingRuleView,
  MappingTestResult,
  ObservationRowView,
  UsageRow,
  UsageEvalRequest,
  UsageEvalResult,
  RecommendationCardData,
  UsageSummary,
} from '../server/src/types/extra.f03'
import type { App, Finding, Settings } from '../src/types/contract'

export interface ActivityFilters {
  app?: App
  userId?: string
  mapped?: 'true' | 'false'
  limit?: number
  cursor?: string
}

export interface UsageFilters {
  userId?: string
  app?: App
  state?: 'active' | 'infrequent' | 'stale' | 'unused' | 'unknown' | 'never_used'
  dormant?: 'true' | 'false'
  seasonal?: 'true' | 'false'
  minRisk?: number
  limit?: number
  cursor?: string
}

export interface ActivitySummaryResponse {
  totalEvents: number
  mappedEvents: number
  unmappedEvents: number
  topUnmappedEvents: Array<{ action: string; count: number }>
}

export interface ScenarioF03Response {
  label: string
  scenarios: Array<{
    code: string
    name: string
    expected: string
    actual: string
    pass: boolean
  }>
  allPassed: boolean
}

export function createF03Api(baseUrl = 'http://localhost:8787') {
  async function request<T>(method: string, path: string, body?: any): Promise<T> {
    const sessionId = localStorage.getItem('accessdrift_session_id') || 'sess-default'
    const actorId = localStorage.getItem('accessdrift_actor_id') || 'rev-asha'

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        'x-actor-id': actorId,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Request failed with status ${res.status}`)
    }

    return res.json()
  }

  return {
    // Activity
    getActivity: (filters: ActivityFilters = {}) => {
      const params = new URLSearchParams()
      if (filters.app) params.set('app', filters.app)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.mapped) params.set('mapped', filters.mapped)
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.cursor) params.set('cursor', filters.cursor)
      return request<{ items: ActivityRow[]; total: number; cursor?: string }>(
        'GET',
        `/api/activity?${params.toString()}`
      )
    },

    getActivitySummary: (app?: App) =>
      request<ActivitySummaryResponse>('GET', `/api/activity/summary${app ? `?app=${app}` : ''}`),

    // Mapping Rules
    getMappingRules: () =>
      request<{ rules: MappingRuleView[]; total: number }>('GET', '/api/mapping-rules'),

    testMapping: (action: string, app: App) =>
      request<MappingTestResult>('POST', '/api/mapping/test', { action, app }),

    createMappingRule: (rule: { app: App; actionPattern: string; entitlementId: string; note?: string }) =>
      request<MappingRuleView>('POST', '/api/mapping-rules', rule),

    updateMappingRule: (id: string, updates: Partial<{ actionPattern: string; entitlementId: string; note: string }>) =>
      request<MappingRuleView>('PUT', `/api/mapping-rules/${id}`, updates),

    deleteMappingRule: (id: string) =>
      request<{ success: boolean; deletedRuleId: string }>('DELETE', `/api/mapping-rules/${id}`),

    // Ingest Runs & Simulation
    getIngestRuns: (app?: App, limit = 50) =>
      request<{ runs: any[]; total: number }>('GET', `/api/ingest-runs?limit=${limit}${app ? `&app=${app}` : ''}`),

    simulateIngest: (app: App = 'google_workspace') =>
      request<{ success: boolean; count: number; events: ActivityRow[]; unmappedNow: number }>(
        'POST',
        '/api/ingest/simulate',
        { app }
      ),

    // Observation Windows
    getObservationWindows: () =>
      request<{ windows: ObservationRowView[]; total: number }>('GET', '/api/observation-windows'),

    // Usage & Findings
    getUsage: (filters: UsageFilters = {}) => {
      const params = new URLSearchParams()
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.app) params.set('app', filters.app)
      if (filters.state) params.set('state', filters.state)
      if (filters.dormant) params.set('dormant', filters.dormant)
      if (filters.seasonal) params.set('seasonal', filters.seasonal)
      if (filters.minRisk !== undefined) params.set('minRisk', String(filters.minRisk))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.cursor) params.set('cursor', filters.cursor)
      return request<{ items: UsageRow[]; total: number; cursor?: string }>(
        'GET',
        `/api/usage?${params.toString()}`
      )
    },

    getUsageItem: (userId: string, entitlementId: string) =>
      request<UsageRow>('GET', `/api/usage/${userId}/${entitlementId}`),

    getUsageFindings: () =>
      request<{ findings: Finding[]; total: number }>('GET', '/api/usage/findings'),

    evaluateUsage: (payload: UsageEvalRequest) =>
      request<UsageEvalResult>('POST', '/api/usage/evaluate', payload),

    // Recommendation & Coverage Guard
    getRecommendation: (userId: string, entitlementId: string) =>
      request<RecommendationCardData>('GET', `/api/recommendation/${userId}/${entitlementId}`),

    getCoverageGuard: (userId: string, entitlementId: string) =>
      request<{
        guardText: string
        observedDays: number
        windowDays: number
        coverageDays: number
        isShortLogs: boolean
        canRevoke: boolean
      }>('GET', `/api/coverage-guard/${userId}/${entitlementId}`),

    // Tags & Session Overlays
    getTags: () =>
      request<{ entitlementTags: Record<string, string[]>; sessionOverrides: any }>('GET', '/api/tags'),

    putTags: (payload: { targetType: 'user' | 'entitlement'; targetId: string; tags: string[] }) =>
      request<{ success: boolean }>('PUT', '/api/tags', payload),

    deleteTag: (payload: { targetType: 'user' | 'entitlement'; targetId: string; tag: string }) =>
      request<{ success: boolean }>('DELETE', '/api/tags', payload),

    // Settings
    getEffectiveSettings: () =>
      request<Settings>('GET', '/api/settings/effective'),

    setEffectiveSettings: (settings: Partial<Settings>) =>
      request<{ settings: Settings; diff: { added: number; removed: number; actionChanged: number } }>(
        'PUT',
        '/api/settings/effective',
        settings
      ),

    resetEffectiveSettings: () =>
      request<Settings>('POST', '/api/settings/reset'),

    clearSessionOverlay: () =>
      request<{ success: boolean }>('DELETE', '/api/session/overlay'),

    // Scenarios
    getScenarioChecksF03: () =>
      request<ScenarioF03Response>('GET', '/api/scenario-checks/f03'),

    // Usage Summary (AI with template fallback)
    getUsageSummary: (userId: string, app?: App, showNames = false) =>
      request<{ summary: UsageSummary }>('POST', '/api/usage-summary', { userId, app, showNames }),

    // CSV Download URLs
    getActivityCsvUrl: () => `${baseUrl}/api/export/activity.csv`,
    getUsageCsvUrl: () => `${baseUrl}/api/export/usage.csv`,
    getInventoryCsvUrl: () => `${baseUrl}/api/export/inventory.csv`,
  }
}
