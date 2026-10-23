import type { App, Grant, Snapshot, Evidence, AuditEvent } from '@contract'
import type { SyncSchedule, SyncRun, RoleChange, Connector, Reviewer, Paged } from '../types/extra.js'
import type {
  ActivityEvent,
  EventMappingRule,
  IngestRun,
  UsageSummary,
} from '../types/extra.f03.js'
import type { DataStore } from './DataStore.js'
import {
  users,
  entitlements,
  snapshots as frontendSnapshots,
  roleChanges as frontendRoleChanges,
  findings,
  evidence as frontendEvidence,
  activity as frontendActivity,
} from '../../../src/data.js'
import { problems } from '../problem.js'
import { logger } from '../logger.js'
import { mapApp, reverseApp } from '../mappers.js'
import { resetIngestSimulation } from '../engine-ext/ingestSim.js'
import { clearAllSessionOverlays } from '../engine-ext/overlay.js'
import { isLive } from '../env.js'

// Generate minimal grants from findings
function generateGrantsFromFindings(): Grant[] {
  const grantMap = new Map<string, Grant>()
  let grantIndex = 0

  findings.forEach((finding) => {
    const key = `${finding.userId}-${finding.entitlementId}`
    if (!grantMap.has(key)) {
      const entitlement = entitlements.find((e) => e.id === finding.entitlementId)
      if (!entitlement) return

      grantIndex++
      grantMap.set(key, {
        id: `grant-${String(grantIndex).padStart(4, '0')}`,
        userId: finding.userId,
        entitlementId: finding.entitlementId,
        app: mapApp(entitlement.app),
        grantedAt: '2025-01-01T00:00:00Z',
        removedAt: null,
        source: 'directory_sync',
        firstSeenSnapshotId: 'snap-initial',
        lastSeenSnapshotId: null,
      })
    }
  })

  return Array.from(grantMap.values())
}

// Generate snapshots with computed hashes
async function generateSnapshots(): Promise<Snapshot[]> {
  const grants = generateGrantsFromFindings()

  const result: Snapshot[] = []
  for (const snap of frontendSnapshots) {
    const app = mapApp(snap.app)
    const takenAt = snap.date + 'T00:00:00Z'

    const activeGrants = grants.filter(
      (g) => g.app === app && g.grantedAt <= takenAt && (g.removedAt === null || g.removedAt > takenAt)
    )

    const grantStrings = activeGrants
      .map((g) => `${g.userId}|${g.entitlementId}`)
      .sort()
      .join('\n')

    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(grantStrings))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    result.push({
      id: snap.id,
      app,
      takenAt,
      complete: snap.complete,
      memberCount: activeGrants.length,
      contentHash: snap.complete ? hashHex : 'skipped · incomplete',
    })
  }

  return result
}

export class MemoryStore implements DataStore {
  private users = users.map((u) => ({
    id: u.id,
    displayName: u.name,
    pseudonym: u.pseudonym,
    department: u.department,
    title: u.title,
    managerId: u.manager || null,
    employmentType: u.employmentType,
    startDate: u.startDate,
    seniority: u.seniority as 'junior' | 'mid' | 'senior' | 'lead',
  }))

  private entitlements = entitlements.map((e) => ({
    id: e.id,
    app: mapApp(e.app),
    name: e.name,
    kind: e.kind,
    privilegeLevel: e.level,
    dataSensitivity: (e.sensitivity === 'admin'
      ? 'pii_financial'
      : e.sensitivity === 'high'
      ? 'confidential'
      : e.sensitivity === 'medium'
      ? 'internal'
      : 'public') as 'public' | 'internal' | 'confidential' | 'pii_financial',
    categories: e.categories,
    seasonal: e.seasonal,
    downgradeToId: e.downgradeTo,
    version: 1,
  }))

  private grants: Grant[] = []
  private snapshots: Snapshot[] = []
  private evidence: Evidence[] = []
  private syncRuns: SyncRun[] = []
  private syncSchedules = new Map<App, SyncSchedule>()
  private roleChanges: RoleChange[] = []
  private auditEvents: AuditEvent[] = []
  private connectors: Connector[] = []
  private reviewers: Reviewer[] = []
  private devFlags = new Map<string, unknown>()
  private driftSummaries = new Map<string, any>()

  // F-03 State
  private activityEvents: ActivityEvent[] = []
  private mappingRules: EventMappingRule[] = []
  private ingestRuns: IngestRun[] = []
  private usageSummaries = new Map<string, UsageSummary>()

  constructor() {
    if (isLive) {
      throw new Error('MemoryStore with seed data is not allowed in live mode. Use STORE=supabase')
    }
    this.initialize()
  }

  private async initialize() {
    this.grants = generateGrantsFromFindings()
    this.snapshots = await generateSnapshots()

    this.evidence = frontendEvidence.map((e) => ({
      id: e.id,
      type: e.type,
      occurredAt: e.at,
      source: e.source,
      payload: e.payload,
      derived: e.derived,
    }))

    this.roleChanges = frontendRoleChanges.map((rc) => ({
      id: rc.id,
      userId: rc.userId,
      previousDepartment: rc.from,
      newDepartment: rc.to,
      previousTitle: null,
      newTitle: null,
      previousManager: null,
      newManager: null,
      changedAt: rc.date + 'T00:00:00Z',
      graceDays: 30,
      status: rc.status === 'In grace' ? 'in_grace' : 'past_grace',
    }))

    this.connectors = [
      { id: 'conn-google', app: 'google_workspace', status: 'active', lastSyncAt: '2026-10-23T00:00:00Z', dataAsOf: '2026-10-23', coverageDays: 180, consentedBy: 'rev-asha', consentedAt: '2026-10-01T00:00:00Z', revokedAt: null },
      { id: 'conn-entra', app: 'microsoft_entra', status: 'active', lastSyncAt: '2026-10-23T00:00:00Z', dataAsOf: '2026-10-23', coverageDays: 30, consentedBy: 'rev-asha', consentedAt: '2026-10-01T00:00:00Z', revokedAt: null },
      { id: 'conn-github', app: 'github', status: 'active', lastSyncAt: '2026-10-23T00:00:00Z', dataAsOf: '2026-10-23', coverageDays: 90, consentedBy: 'rev-asha', consentedAt: '2026-10-01T00:00:00Z', revokedAt: null },
    ]

    this.reviewers = [
      { id: 'rev-asha', displayName: 'Asha Rao', pseudonym: 'Person 001', department: 'Support', isActive: true },
      { id: 'rev-vikram', displayName: 'Vikram Shah', pseudonym: 'Person 002', department: 'Finance', isActive: true },
      { id: 'rev-nisha', displayName: 'Nisha Verma', pseudonym: 'Person 003', department: 'Data Analytics', isActive: true },
    ]

    this.syncSchedules.set('google_workspace', {
      app: 'google_workspace',
      frequency: 'weekly',
      enabled: true,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: '2026-10-29T00:00:00Z',
      actorId: 'rev-vikram',
      updatedAt: '2026-10-01T00:00:00Z',
    })
    this.syncSchedules.set('microsoft_entra', {
      app: 'microsoft_entra',
      frequency: 'daily',
      enabled: true,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: '2026-10-23T00:00:00Z',
      actorId: 'rev-vikram',
      updatedAt: '2026-10-01T00:00:00Z',
    })
    this.syncSchedules.set('github', {
      app: 'github',
      frequency: 'weekly',
      enabled: true,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: '2026-10-29T00:00:00Z',
      actorId: 'rev-vikram',
      updatedAt: '2026-10-01T00:00:00Z',
    })

    // Initialize F-03 Seed Activity Events
    this.activityEvents = frontendActivity.map((a) => ({
      id: a.id,
      userId: a.userId,
      app: mapApp(a.app),
      at: a.at.includes('T') ? a.at : a.at + 'T00:00:00Z',
      action: a.action,
      resource: a.resource,
      actionClass: a.actionClass,
      isSimulated: false,
      ingestRunId: null,
      createdAt: a.at.includes('T') ? a.at : a.at + 'T00:00:00Z',
    }))

    // Initialize F-03 Seed Mapping Rules
    this.mappingRules = [
      { id: 'rule-gw-1', app: 'google_workspace', actionPattern: 'drive.admin.*', entitlementId: 'e-drive-admin', note: 'Maps administrative drive actions' },
      { id: 'rule-gw-2', app: 'google_workspace', actionPattern: 'drive.write*', entitlementId: 'e-drive-write', note: 'Maps write drive actions' },
      { id: 'rule-gw-3', app: 'google_workspace', actionPattern: 'drive.read', entitlementId: 'e-support-read', note: 'Maps read drive actions to support read' },
      { id: 'rule-gh-1', app: 'github', actionPattern: 'repo.push*', entitlementId: 'e-github-write', note: 'Maps repository push events' },
      { id: 'rule-gh-2', app: 'github', actionPattern: 'repo.branch.*', entitlementId: 'e-github-write', note: 'Maps repository branch operations' },
      { id: 'rule-gh-3', app: 'github', actionPattern: 'repo.read*', entitlementId: 'e-github-read', note: 'Maps repository read events' },
      { id: 'rule-gh-4', app: 'github', actionPattern: 'release.artifact.export', entitlementId: 'e-repo-export', note: 'Maps release artifact export events' },
      { id: 'rule-me-1', app: 'microsoft_entra', actionPattern: 'directory.role.*', entitlementId: 'e-entra-admin', note: 'Maps directory role assignment' },
      { id: 'rule-me-2', app: 'microsoft_entra', actionPattern: 'directory.user.*', entitlementId: 'e-entra-admin', note: 'Maps directory user read' },
    ]

    // Initialize F-03 Seed Ingest Runs
    this.ingestRuns = [
      { id: 'ingest-gw-seed', app: 'google_workspace', at: '2026-10-23T00:00:00Z', windowFrom: '2026-04-26T00:00:00Z', windowTo: '2026-10-23T00:00:00Z', eventsPulled: 3, unmapped: 1, status: 'completed', ingIndex: null, isSimulated: false, createdAt: '2026-10-23T00:00:00Z' },
      { id: 'ingest-gh-seed', app: 'github', at: '2026-10-23T00:00:00Z', windowFrom: '2026-07-25T00:00:00Z', windowTo: '2026-10-23T00:00:00Z', eventsPulled: 1, unmapped: 0, status: 'completed', ingIndex: null, isSimulated: false, createdAt: '2026-10-23T00:00:00Z' },
      { id: 'ingest-me-seed', app: 'microsoft_entra', at: '2026-10-23T00:00:00Z', windowFrom: '2026-09-23T00:00:00Z', windowTo: '2026-10-23T00:00:00Z', eventsPulled: 1, unmapped: 0, status: 'completed', ingIndex: null, isSimulated: false, createdAt: '2026-10-23T00:00:00Z' },
    ]

    logger.info('MemoryStore initialized with seed data')
  }

  // Users
  async listUsers(limit = 100, offset = 0) {
    const items = this.users.slice(offset, offset + limit)
    return { items, total: this.users.length, limit, offset }
  }

  async getUserById(id: string) {
    return this.users.find((u) => u.id === id) || null
  }

  // Entitlements
  async listEntitlements(limit = 100, offset = 0) {
    const items = this.entitlements.slice(offset, offset + limit)
    return { items, total: this.entitlements.length, limit, offset }
  }

  async getEntitlementById(id: string) {
    return this.entitlements.find((e) => e.id === id) || null
  }

  // Grants
  async listGrants(filters: any = {}, limit = 100, offset = 0) {
    let result = [...this.grants]
    if (filters.userId) result = result.filter((g) => g.userId === filters.userId)
    if (filters.entitlementId) result = result.filter((g) => g.entitlementId === filters.entitlementId)
    if (filters.app) result = result.filter((g) => g.app === filters.app)

    const items = result.slice(offset, offset + limit)
    return { items, total: result.length, limit, offset }
  }

  async getGrantById(id: string) {
    return this.grants.find((g) => g.id === id) || null
  }

  async insertGrant(grant: Omit<Grant, 'id'> & { id?: string; isSimulated?: boolean; createdAt?: string }): Promise<Grant> {
    const newGrant: Grant = {
      ...grant,
      id: grant.id || `grant-${String(this.grants.length + 1).padStart(4, '0')}`,
      createdAt: grant.createdAt || new Date().toISOString(),
    } as any

    this.grants.push(newGrant)
    return newGrant
  }

  async updateGrantRemovedAt(id: string, removedAt: string | null, lastSeenSnapshotId: string | null) {
    const grant = this.grants.find((g) => g.id === id)
    if (grant) {
      grant.removedAt = removedAt
      grant.lastSeenSnapshotId = lastSeenSnapshotId
    }
  }

  // Snapshots
  async listSnapshots(filters: any = {}, limit = 100, offset = 0) {
    let result = [...this.snapshots]
    if (filters.app) result = result.filter((s) => s.app === filters.app)

    const items = result.slice(offset, offset + limit)
    return { items, total: result.length, limit, offset }
  }

  async getSnapshotById(id: string) {
    return this.snapshots.find((s) => s.id === id) || null
  }

  async insertSnapshot(snapshot: Omit<Snapshot, 'id'> & { id?: string; isSimulated?: boolean; createdAt?: string }): Promise<Snapshot> {
    const newSnapshot: Snapshot = {
      ...snapshot,
      id: snapshot.id || `snap-${Date.now()}`,
      createdAt: snapshot.createdAt || new Date().toISOString(),
    } as any

    this.snapshots.push(newSnapshot)
    return newSnapshot
  }

  async updateSnapshot(id: string, changes: Partial<Snapshot>) {
    throw problems.forbidden('Snapshots are append-only: UPDATE is forbidden')
  }

  async deleteSnapshot(id: string) {
    throw problems.forbidden('Snapshots are append-only: DELETE is forbidden')
  }

  // Evidence
  async getEvidenceById(id: string) {
    return this.evidence.find((e) => e.id === id) || null
  }

  async listEvidence(evidenceIds: string[]) {
    return this.evidence.filter((e) => evidenceIds.includes(e.id))
  }

  async insertEvidence(evidence: Omit<Evidence, 'id'> & { id?: string }): Promise<Evidence> {
    const newEvidence: Evidence = {
      ...evidence,
      id: evidence.id || `ev-${Date.now()}`,
    }
    this.evidence.push(newEvidence)
    return newEvidence
  }

  // Sync
  async listSyncRuns(app?: App) {
    let result = [...this.syncRuns]
    if (app) result = result.filter((r) => r.app === app)
    return result
  }

  async insertSyncRun(run: Omit<SyncRun, 'id'> & { id?: string }): Promise<SyncRun> {
    const newRun: SyncRun = {
      ...run,
      id: run.id || `sync-${Date.now()}`,
    }
    this.syncRuns.push(newRun)
    return newRun
  }

  async getSyncSchedule(app: App) {
    return this.syncSchedules.get(app) || null
  }

  async upsertSyncSchedule(schedule: SyncSchedule) {
    this.syncSchedules.set(schedule.app, schedule)
    return schedule
  }

  // Role Changes
  async listRoleChanges(userId?: string) {
    let result = [...this.roleChanges]
    if (userId) result = result.filter((rc) => rc.userId === userId)
    return result
  }

  async insertRoleChange(change: Omit<RoleChange, 'id'> & { id?: string }): Promise<RoleChange> {
    const newChange: RoleChange = {
      ...change,
      id: change.id || `rc-${Date.now()}`,
    }
    this.roleChanges.push(newChange)
    return newChange
  }

  // Audit
  async listAudit(filters: any = {}, limit = 100, offset = 0) {
    let result = [...this.auditEvents]
    if (filters.action) result = result.filter((a) => a.action === filters.action)
    if (filters.actorId) result = result.filter((a) => a.actorId === filters.actorId)

    const items = result.slice(offset, offset + limit)
    return { items, total: result.length, limit, offset }
  }

  async insertAudit(event: Omit<AuditEvent, 'id'> & { id?: string; prevHash?: string; hash?: string }): Promise<AuditEvent> {
    const prevEvent = this.auditEvents[this.auditEvents.length - 1]
    const prevHash = prevEvent?.hash || '0'.repeat(64)

    const content = `${event.at}|${event.actorId}|${event.action}|${event.targetType}|${event.targetId}|${event.detail}|${prevHash}`
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
    const hash = 'sha256:' + Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')

    const newEvent: AuditEvent = {
      ...event,
      id: event.id || `au-${this.auditEvents.length + 1}`,
      prevHash,
      hash,
    }

    this.auditEvents.push(newEvent)
    return newEvent
  }

  // Connectors
  async listConnectors() {
    return [...this.connectors]
  }

  async getConnector(app: App) {
    return this.connectors.find((c) => c.app === app) || null
  }

  async updateConnector(connector: Partial<Connector> & { app: App }) {
    const existing = this.connectors.find((c) => c.app === connector.app)
    if (existing) {
      Object.assign(existing, connector)
    }
  }

  // Reviewers
  async listReviewers() {
    return [...this.reviewers]
  }

  async getReviewerById(id: string) {
    return this.reviewers.find((r) => r.id === id) || null
  }

  // Dev flags
  async getDevFlag(key: string) {
    return this.devFlags.get(key) ?? null
  }

  async setDevFlag(key: string, value: unknown) {
    this.devFlags.set(key, value)
  }

  // Drift summaries
  async getDriftSummary(scopeKey: string): Promise<any | null> {
    return this.driftSummaries.get(scopeKey) || null
  }

  async setDriftSummary(scopeKey: string, summary: any): Promise<void> {
    this.driftSummaries.set(scopeKey, summary)
  }

  // Health
  async getCounts(): Promise<{ users: number; entitlements: number; grants: number; snapshots: number; auditEvents: number }> {
    return {
      users: this.users.length,
      entitlements: this.entitlements.length,
      grants: this.grants.length,
      snapshots: this.snapshots.length,
      auditEvents: this.auditEvents.length,
    }
  }

  // Reset (dev only)
  async resetSimulated(): Promise<{ deleted: Record<string, number> }> {
    const deleted: Record<string, number> = {
      grants: 0,
      snapshots: 0,
      syncRuns: 0,
      auditEvents: 0,
      activityEvents: 0,
      ingestRuns: 0,
      usageSummaries: 0,
    }

    // Remove simulated entries
    const initialGrants = this.grants.length
    this.grants = this.grants.filter((g) => !(g as any).isSimulated)
    deleted.grants = initialGrants - this.grants.length

    const initialSnapshots = this.snapshots.length
    this.snapshots = this.snapshots.filter((s) => !(s as any).isSimulated)
    deleted.snapshots = initialSnapshots - this.snapshots.length

    const initialSyncRuns = this.syncRuns.length
    this.syncRuns = this.syncRuns.filter((r) => !r.isSimulated)
    deleted.syncRuns = initialSyncRuns - this.syncRuns.length

    const initialAudit = this.auditEvents.length
    this.auditEvents = this.auditEvents.filter((a) => !(a as any).isSimulated)
    deleted.auditEvents = initialAudit - this.auditEvents.length

    // F-03 simulated cleanup
    const initialActivity = this.activityEvents.length
    this.activityEvents = this.activityEvents.filter((a) => !a.isSimulated)
    deleted.activityEvents = initialActivity - this.activityEvents.length

    const initialIngest = this.ingestRuns.length
    this.ingestRuns = this.ingestRuns.filter((r) => !r.isSimulated)
    deleted.ingestRuns = initialIngest - this.ingestRuns.length

    deleted.usageSummaries = this.usageSummaries.size
    this.usageSummaries.clear()

    // Restore dev flags, session overlays, ingest simulation state
    this.devFlags.clear()
    clearAllSessionOverlays()
    resetIngestSimulation()

    return { deleted }
  }

  // Live integration: persist sync (stub for MemoryStore)
  async persistSync(
    tenantId: string,
    snapshot: any,
    run: any,
    grants: any[],
    users: any[],
    entitlements: any[],
    audit: any
  ): Promise<{ success: boolean; snapshotId: string; syncRunId: string; tenantId: string }> {
    // MemoryStore doesn't support tenant-based persistence
    throw new Error('persistSync is not supported in MemoryStore. Use SupabaseStore.')
  }

  // F-03 Activity Events
  async listActivityEvents(
    filters: { userId?: string; app?: App; actionClass?: string; from?: string; to?: string; isSimulated?: boolean } = {},
    limit = 100,
    offset = 0
  ): Promise<Paged<ActivityEvent>> {
    let result = [...this.activityEvents]

    if (filters.userId) result = result.filter((a) => a.userId === filters.userId)
    if (filters.app) result = result.filter((a) => a.app === filters.app)
    if (filters.actionClass) result = result.filter((a) => a.actionClass === filters.actionClass)
    if (filters.from) result = result.filter((a) => a.at >= filters.from!)
    if (filters.to) result = result.filter((a) => a.at <= filters.to!)
    if (filters.isSimulated !== undefined) result = result.filter((a) => Boolean(a.isSimulated) === filters.isSimulated)

    result.sort((a, b) => b.at.localeCompare(a.at))

    const items = result.slice(offset, offset + limit)
    return { items, total: result.length, limit, offset }
  }

  async insertActivityEvents(events: ActivityEvent[]): Promise<number> {
    for (const ev of events) {
      this.activityEvents.push({
        ...ev,
        createdAt: ev.createdAt || ev.at,
      })
    }
    return events.length
  }

  async updateActivityEvent(id: string, changes: any): Promise<void> {
    throw problems.forbidden('activity_events is append-only: UPDATE is forbidden')
  }

  async deleteActivityEvent(id: string): Promise<void> {
    throw problems.forbidden('activity_events is append-only: DELETE is forbidden')
  }

  // F-03 Mapping Rules
  async listMappingRules(app?: App): Promise<EventMappingRule[]> {
    let result = [...this.mappingRules]
    if (app) result = result.filter((r) => r.app === app)
    return result
  }

  async insertMappingRule(rule: EventMappingRule): Promise<EventMappingRule> {
    this.mappingRules.push(rule)
    return rule
  }

  async updateMappingRule(id: string, updates: Partial<EventMappingRule>): Promise<EventMappingRule | null> {
    const existing = this.mappingRules.find((r) => r.id === id)
    if (!existing) return null
    Object.assign(existing, updates)
    return existing
  }

  async deleteMappingRule(id: string): Promise<boolean> {
    const idx = this.mappingRules.findIndex((r) => r.id === id)
    if (idx === -1) return false
    this.mappingRules.splice(idx, 1)
    return true
  }

  // F-03 Ingest Runs
  async listIngestRuns(app?: App): Promise<IngestRun[]> {
    let result = [...this.ingestRuns]
    if (app) result = result.filter((r) => r.app === app)
    result.sort((a, b) => b.at.localeCompare(a.at))
    return result
  }

  async insertIngestRun(run: IngestRun): Promise<IngestRun> {
    this.ingestRuns.push(run)
    return run
  }

  async updateIngestRun(id: string, changes: any): Promise<void> {
    throw problems.forbidden('ingest_runs is append-only: UPDATE is forbidden')
  }

  async deleteIngestRun(id: string): Promise<void> {
    throw problems.forbidden('ingest_runs is append-only: DELETE is forbidden')
  }

  // F-03 Usage Summaries
  async getUsageSummary(scopeKey: string): Promise<UsageSummary | null> {
    return this.usageSummaries.get(scopeKey) || null
  }

  async saveUsageSummary(scopeKey: string, summary: UsageSummary): Promise<void> {
    this.usageSummaries.set(scopeKey, summary)
  }
}
