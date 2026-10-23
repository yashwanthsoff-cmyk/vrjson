import type { App, Grant, Snapshot, Evidence, AuditEvent } from '@contract'
import type { SyncSchedule, SyncRun, RoleChange, Connector, Reviewer, Paged } from '../types/extra.js'
import type { DataStore } from './DataStore.js'
import { users, entitlements, snapshots as frontendSnapshots, roleChanges as frontendRoleChanges, findings, evidence as frontendEvidence } from '../../src/data.js'
import { problems } from '../problem.js'
import { logger } from '../logger.js'
import { mapApp, reverseApp } from '../mappers.js'

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
        grantedAt: '2025-01-01T00:00:00Z', // Default to a past date
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
  const snapshotMap = new Map<string, Snapshot>()

  for (const snap of frontendSnapshots) {
    const app = mapApp(snap.app)
    const takenAt = snap.date + 'T00:00:00Z'

    // Get grants active at this snapshot time
    const activeGrants = grants.filter(
      (g) => g.app === app && g.grantedAt <= takenAt && (g.removedAt === null || g.removedAt > takenAt)
    )

    // Compute content hash
    const grantStrings = activeGrants
      .map((g) => `${g.userId}|${g.entitlementId}`)
      .sort()
      .join('\n')

    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(grantStrings))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    snapshotMap.set(snap.id, {
      id: snap.id,
      app,
      takenAt,
      complete: snap.complete,
      memberCount: activeGrants.length,
      contentHash: hashHex,
    })
  }

  return Array.from(snapshotMap.values())
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
    dataSensitivity: e.sensitivity === 'admin' ? 'pii_financial' : e.sensitivity === 'high' ? 'confidential' : e.sensitivity === 'medium' ? 'internal' : 'public',
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

  constructor() {
    this.initialize()
  }

  private async initialize() {
    this.grants = generateGrantsFromFindings()
    this.snapshots = await generateSnapshots()

    // Map evidence
    this.evidence = frontendEvidence.map((e) => ({
      id: e.id,
      type: e.type,
      occurredAt: e.at,
      source: e.source,
      payload: e.payload,
      derived: e.derived,
    }))

    // Map role changes
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

    // Initialize connectors
    this.connectors = [
      { id: 'conn-google', app: 'google_workspace', status: 'active', lastSyncAt: '2026-10-23T00:00:00Z', dataAsOf: '2026-10-23', coverageDays: 180, consentedBy: 'rev-asha', consentedAt: '2026-10-01T00:00:00Z', revokedAt: null },
      { id: 'conn-entra', app: 'microsoft_entra', status: 'active', lastSyncAt: '2026-10-23T00:00:00Z', dataAsOf: '2026-10-23', coverageDays: 30, consentedBy: 'rev-asha', consentedAt: '2026-10-01T00:00:00Z', revokedAt: null },
      { id: 'conn-github', app: 'github', status: 'active', lastSyncAt: '2026-10-23T00:00:00Z', dataAsOf: '2026-10-23', coverageDays: 90, consentedBy: 'rev-asha', consentedAt: '2026-10-01T00:00:00Z', revokedAt: null },
    ]

    // Initialize reviewers
    this.reviewers = [
      { id: 'rev-asha', displayName: 'Asha Rao', pseudonym: 'Person 001', department: 'Support', isActive: true },
      { id: 'rev-vikram', displayName: 'Vikram Shah', pseudonym: 'Person 002', department: 'Finance', isActive: true },
      { id: 'rev-nisha', displayName: 'Nisha Verma', pseudonym: 'Person 003', department: 'Data Analytics', isActive: true },
    ]

    // Initialize sync schedules
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
      lastRunAt: '2026-10-16T00:00:00Z',
      nextRunAt: '2026-10-23T00:00:00Z',
      actorId: 'rev-vikram',
      updatedAt: '2026-10-01T00:00:00Z',
    })

    logger.info('MemoryStore initialized with seed data')
  }

  // Users
  async listUsers(limit = 100, offset = 0): Promise<Paged<any>> {
    const items = this.users.slice(offset, offset + limit)
    return { items, total: this.users.length, limit, offset }
  }

  async getUserById(id: string): Promise<any> {
    return this.users.find((u) => u.id === id) || null
  }

  // Entitlements
  async listEntitlements(limit = 100, offset = 0): Promise<Paged<any>> {
    const items = this.entitlements.slice(offset, offset + limit)
    return { items, total: this.entitlements.length, limit, offset }
  }

  async getEntitlementById(id: string): Promise<any> {
    return this.entitlements.find((e) => e.id === id) || null
  }

  // Grants
  async listGrants(filters: {}, limit = 100, offset = 0): Promise<Paged<Grant>> {
    let filtered = [...this.grants]

    if (filters.userId) filtered = filtered.filter((g) => g.userId === filters.userId)
    if (filters.app) filtered = filtered.filter((g) => g.app === filters.app)
    if (filters.entitlementId) filtered = filtered.filter((g) => g.entitlementId === filters.entitlementId)
    if (filters.source) filtered = filtered.filter((g) => g.source === filters.source)
    if (filters.activeOn) {
      const date = filters.activeOn
      filtered = filtered.filter((g) => g.grantedAt <= date && (g.removedAt === null || g.removedAt > date))
    }
    if (filters.removed !== undefined) {
      if (filters.removed) filtered = filtered.filter((g) => g.removedAt !== null)
      else filtered = filtered.filter((g) => g.removedAt === null)
    }

    const items = filtered.slice(offset, offset + limit)
    return { items, total: filtered.length, limit, offset }
  }

  async getGrantById(id: string): Promise<Grant | null> {
    return this.grants.find((g) => g.id === id) || null
  }

  async insertGrant(grant: Omit<Grant, 'id'> & { id?: string }): Promise<Grant> {
    const newGrant: Grant = {
      id: grant.id || `grant-${String(this.grants.length + 1).padStart(4, '0')}`,
      ...grant,
    }
    this.grants.push(newGrant)
    return newGrant
  }

  async updateGrantRemovedAt(id: string, removedAt: string | null, lastSeenSnapshotId: string | null): Promise<void> {
    const grant = this.grants.find((g) => g.id === id)
    if (!grant) throw problems.notFound('Grant not found')

    // Append-only check: removedAt can only be set once
    if (grant.removedAt !== null && removedAt !== null && grant.removedAt !== removedAt) {
      throw problems.conflict('Grant already removed; add a new record instead')
    }

    grant.removedAt = removedAt
    grant.lastSeenSnapshotId = lastSeenSnapshotId
  }

  // Snapshots
  async listSnapshots(filters: {}, limit = 100, offset = 0): Promise<Paged<Snapshot>> {
    let filtered = [...this.snapshots]

    if (filters.app) filtered = filtered.filter((s) => s.app === filters.app)
    if (filters.from) filtered = filtered.filter((s) => s.takenAt >= filters.from)
    if (filters.to) filtered = filtered.filter((s) => s.takenAt <= filters.to)
    if (filters.complete !== undefined) filtered = filtered.filter((s) => s.complete === filters.complete)

    const items = filtered.slice(offset, offset + limit)
    return { items, total: filtered.length, limit, offset }
  }

  async getSnapshotById(id: string): Promise<Snapshot | null> {
    return this.snapshots.find((s) => s.id === id) || null
  }

  async insertSnapshot(snapshot: Omit<Snapshot, 'id'> & { id?: string }): Promise<Snapshot> {
    const newSnapshot: Snapshot = {
      id: snapshot.id || `snap-${Date.now()}`,
      ...snapshot,
    }
    this.snapshots.push(newSnapshot)
    return newSnapshot
  }

  // Evidence
  async getEvidenceById(id: string): Promise<Evidence | null> {
    return this.evidence.find((e) => e.id === id) || null
  }

  async listEvidence(evidenceIds: string[]): Promise<Evidence[]> {
    return this.evidence.filter((e) => evidenceIds.includes(e.id))
  }

  async insertEvidence(evidence: Omit<Evidence, 'id'> & { id?: string }): Promise<Evidence> {
    const newEvidence: Evidence = {
      id: evidence.id || `ev-${Date.now()}`,
      ...evidence,
    }
    this.evidence.push(newEvidence)
    return newEvidence
  }

  // Sync
  async listSyncRuns(app?: App): Promise<SyncRun[]> {
    if (app) return this.syncRuns.filter((r) => r.app === app)
    return [...this.syncRuns]
  }

  async insertSyncRun(run: Omit<SyncRun, 'id'> & { id?: string }): Promise<SyncRun> {
    const newRun: SyncRun = {
      id: run.id || `sync-${Date.now()}`,
      ...run,
    }
    this.syncRuns.push(newRun)
    return newRun
  }

  async getSyncSchedule(app: App): Promise<SyncSchedule | null> {
    return this.syncSchedules.get(app) || null
  }

  async upsertSyncSchedule(schedule: SyncSchedule): Promise<SyncSchedule> {
    this.syncSchedules.set(schedule.app, schedule)
    return schedule
  }

  // Role Changes
  async listRoleChanges(userId?: string): Promise<RoleChange[]> {
    if (userId) return this.roleChanges.filter((rc) => rc.userId === userId)
    return [...this.roleChanges]
  }

  async insertRoleChange(change: Omit<RoleChange, 'id'> & { id?: string }): Promise<RoleChange> {
    const newChange: RoleChange = {
      id: change.id || `rc-${Date.now()}`,
      ...change,
    }
    this.roleChanges.push(newChange)
    return newChange
  }

  // Audit
  async listAudit(filters: {}, limit = 100, offset = 0): Promise<Paged<AuditEvent>> {
    let filtered = [...this.auditEvents]

    if (filters.actorId) filtered = filtered.filter((a) => a.actorId === filters.actorId)
    if (filters.action) filtered = filtered.filter((a) => a.action === filters.action)
    if (filters.targetType) filtered = filtered.filter((a) => a.targetType === filters.targetType)
    if (filters.from) filtered = filtered.filter((a) => a.at >= filters.from)
    if (filters.to) filtered = filtered.filter((a) => a.at <= filters.to)
    if (filters.q) {
      const q = filters.q.toLowerCase()
      filtered = filtered.filter((a) => a.detail.toLowerCase().includes(q) || a.targetId.toLowerCase().includes(q))
    }

    const items = filtered.slice(offset, offset + limit)
    return { items, total: filtered.length, limit, offset }
  }

  async insertAudit(event: Omit<AuditEvent, 'id'> & { id?: string }): Promise<AuditEvent> {
    const newEvent: AuditEvent = {
      id: event.id || `au-${Date.now()}`,
      ...event,
    }
    this.auditEvents.push(newEvent)
    return newEvent
  }

  // Connectors
  async listConnectors(): Promise<Connector[]> {
    return [...this.connectors]
  }

  async getConnector(app: App): Promise<Connector | null> {
    return this.connectors.find((c) => c.app === app) || null
  }

  async updateConnector(connector: Partial<Connector> & { app: App }): Promise<void> {
    const index = this.connectors.findIndex((c) => c.app === connector.app)
    if (index === -1) throw problems.notFound('Connector not found')
    this.connectors[index] = { ...this.connectors[index], ...connector }
  }

  // Reviewers
  async listReviewers(): Promise<Reviewer[]> {
    return [...this.reviewers]
  }

  async getReviewerById(id: string): Promise<Reviewer | null> {
    return this.reviewers.find((r) => r.id === id) || null
  }

  // Dev flags
  async getDevFlag(key: string): Promise<unknown | null> {
    return this.devFlags.get(key) || null
  }

  async setDevFlag(key: string, value: unknown): Promise<void> {
    this.devFlags.set(key, value)
  }

  // Drift summaries
  async getDriftSummary(scopeKey: string): Promise<{ cached: boolean; summary: any } | null> {
    const summary = this.driftSummaries.get(scopeKey)
    return summary ? { cached: true, summary } : null
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

    // Restore dev flags
    this.devFlags.clear()

    return deleted
  }
}
