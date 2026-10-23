import type { App, Grant, Snapshot, Evidence, AuditEvent } from '@contract'

export interface Paged<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface AccessAsOfApp {
  app: App
  requestedDate: string
  effectiveDate: string | null
  snapshotUsed: Snapshot | null
  snapped: boolean
  message: string
}

export interface AccessAsOfResult {
  userId: string
  requestedDate: string
  permissions: Grant[]
  perApp: AccessAsOfApp[]
}

export interface DiffSide {
  ref: string
  perApp: AccessAsOfApp[]
}

export interface DiffResult {
  userId: string
  a: DiffSide
  b: DiffSide
  added: Grant[]
  removed: Grant[]
  unchanged: Grant[]
  counts: {
    added: number
    removed: number
    unchanged: number
    atA: number
    atB: number
  }
}

export interface ReplayResult {
  scope: 'all' | 'one'
  checked: number
  passed: number
  failed: number
  skippedIncomplete: string[]
  failingSnapshotIds: string[]
  ranAt: string
}

export interface CoverageCell {
  weekStart: string
  status: 'complete' | 'incomplete' | 'gap'
  snapshotIds: string[]
}

export interface SnapshotCoverage {
  app: App
  cells: CoverageCell[]
}

export interface SyncSchedule {
  app: App
  frequency: 'daily' | 'weekly' | 'manual'
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  actorId: string
  updatedAt: string
}

export interface SyncRun {
  id: string
  app: App
  status: 'ok' | 'error' | 'partial'
  trigger: 'scheduled' | 'manual'
  startedAt: string
  completedAt: string | null
  grantsAdded: number
  grantsRemoved: number
  snapshotId: string
  isSimulated: boolean
  simIndex: number | null
  createdBy: string
}

export interface PrePostComparison {
  userId: string
  eventDate: string
  before: Grant[]
  after: Grant[]
  carriedOver: Grant[]
  carriedOverCount: number
  totalCount: number
}

export interface RoleChange {
  id: string
  userId: string
  previousDepartment: string
  newDepartment: string
  previousTitle: string | null
  newTitle: string | null
  previousManager: string | null
  newManager: string | null
  changedAt: string
  graceDays: number
  status: 'in_grace' | 'past_grace'
}

export interface SyncSimulateResult {
  snapshot: Snapshot
  syncRun: SyncRun
  addedGrants: Grant[]
  evidence: Evidence[]
  auditEventId: string
  simulatedAt: string
  message: string
}

export interface DriftSummary {
  id: string
  userId: string
  from: string
  to: string
  source: 'model' | 'template'
  fallbackUsed: boolean
  label: string
  sentences: Array<{
    id: string
    template: string
    claims: Array<{ id: string; field: string; value: string | number; evidenceId: string }>
  }>
  evidence: Evidence[]
  validation: {
    passed: boolean
    failures: Array<{ claimId: string; reason: string }>
  }
  cached: boolean
  createdAt: string
}

export interface ApiProblem {
  type: string
  title: string
  status: number
  detail: string
}

export interface Connector {
  id: string
  app: App
  status: 'active' | 'revoked' | 'error'
  lastSyncAt: string | null
  dataAsOf: string | null
  coverageDays: number
  consentedBy: string
  consentedAt: string
  revokedAt: string | null
}

export interface Reviewer {
  id: string
  displayName: string
  pseudonym: string
  department: string
  isActive: boolean
}
