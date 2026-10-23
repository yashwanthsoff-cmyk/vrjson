import type { App, Evidence, UsageState } from '@contract'
import { DEMO_NOW } from '../clock.js'
import { getAppRetentionNote } from './guardText.js'

export interface UsageEvidencePayload {
  state: UsageState
  lastUsedAt: string | null
  observedDays: number
  windowDays: number
  daysSinceLastUse: number | null
  dormantAccount: boolean
  coverageDays: number
  retentionNote: string | null
}

/**
 * Creates derived usage evidence record.
 */
export function createUsageEvidence(
  userId: string,
  entitlementId: string,
  app: App,
  payload: UsageEvidencePayload,
  now = DEMO_NOW
): Evidence {
  const dateStr = now.slice(0, 10)
  return {
    id: `ev-usage-${userId}-${entitlementId}`,
    type: 'coverage',
    occurredAt: now,
    source: `${app} activity and retention observation`,
    payload: {
      state: payload.state,
      lastUsedAt: payload.lastUsedAt,
      observedDays: payload.observedDays,
      windowDays: payload.windowDays,
      daysSinceLastUse: payload.daysSinceLastUse,
      dormantAccount: payload.dormantAccount,
      coverageDays: payload.coverageDays,
      retentionNote: payload.retentionNote,
    },
    derived: true,
  }
}

/**
 * Creates coverage evidence record.
 */
export function createCoverageEvidence(
  app: App,
  coverageDays: number,
  now = DEMO_NOW
): Evidence {
  const dateStr = now.slice(0, 10)
  return {
    id: `ev-cov-${app}-${dateStr}`,
    type: 'coverage',
    occurredAt: now,
    source: `${app} connector retention metadata`,
    payload: {
      coverageDays,
      retentionNote: getAppRetentionNote(app),
    },
    derived: true,
  }
}
