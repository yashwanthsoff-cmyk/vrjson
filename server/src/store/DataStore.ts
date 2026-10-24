import type { App, Grant, Snapshot, Evidence, AuditEvent } from '@contract'
import type { SyncSchedule, SyncRun, RoleChange, Connector, Reviewer, Paged } from '../types/extra.js'
import type {
  ActivityEvent,
  EventMappingRule,
  IngestRun,
  UsageSummary,
} from '../types/extra.f03.js'

export interface DataStore {
  // Users
  listUsers(limit?: number, offset?: number): Promise<Paged<{ id: string; displayName: string; pseudonym: string; department: string; title: string; managerId: string | null; employmentType: 'employee' | 'contractor' | 'guest'; startDate: string; seniority: 'junior' | 'mid' | 'senior' | 'lead' }>>
  getUserById(id: string): Promise<{ id: string; displayName: string; pseudonym: string; department: string; title: string; managerId: string | null; employmentType: 'employee' | 'contractor' | 'guest'; startDate: string; seniority: 'junior' | 'mid' | 'senior' | 'lead' } | null>

  // Entitlements
  listEntitlements(limit?: number, offset?: number): Promise<Paged<{ id: string; app: App; name: string; kind: 'role' | 'group' | 'permission'; privilegeLevel: 'read' | 'write' | 'admin'; dataSensitivity: 'public' | 'internal' | 'confidential' | 'pii_financial'; categories: string[]; seasonal?: boolean; downgradeToId?: string; version: number }>>
  getEntitlementById(id: string): Promise<{ id: string; app: App; name: string; kind: 'role' | 'group' | 'permission'; privilegeLevel: 'read' | 'write' | 'admin'; dataSensitivity: 'public' | 'internal' | 'confidential' | 'pii_financial'; categories: string[]; seasonal?: boolean; downgradeToId?: string; version: number } | null>

  // Grants
  listGrants(filters?: any, limit?: number, offset?: number): Promise<Paged<Grant>>
  getGrantById(id: string): Promise<Grant | null>
  insertGrant(grant: Omit<Grant, 'id'> & { id?: string; isSimulated?: boolean; createdAt?: string }): Promise<Grant>
  updateGrantRemovedAt(id: string, removedAt: string | null, lastSeenSnapshotId: string | null): Promise<void>

  // Snapshots
  listSnapshots(filters?: any, limit?: number, offset?: number): Promise<Paged<Snapshot>>
  getSnapshotById(id: string): Promise<Snapshot | null>
  insertSnapshot(snapshot: Omit<Snapshot, 'id'> & { id?: string; isSimulated?: boolean; createdAt?: string }): Promise<Snapshot>
  updateSnapshot(id: string, changes: Partial<Snapshot>): Promise<void>
  deleteSnapshot(id: string): Promise<void>

  // Evidence
  getEvidenceById(id: string): Promise<Evidence | null>
  listEvidence(evidenceIds: string[]): Promise<Evidence[]>
  insertEvidence(evidence: Omit<Evidence, 'id'> & { id?: string }): Promise<Evidence>

  // Sync
  listSyncRuns(app?: App): Promise<SyncRun[]>
  insertSyncRun(run: Omit<SyncRun, 'id'> & { id?: string }): Promise<SyncRun>
  getSyncSchedule(app: App): Promise<SyncSchedule | null>
  upsertSyncSchedule(schedule: SyncSchedule): Promise<SyncSchedule>

  // Role Changes
  listRoleChanges(userId?: string): Promise<RoleChange[]>
  insertRoleChange(change: Omit<RoleChange, 'id'> & { id?: string }): Promise<RoleChange>

  // Audit
  listAudit(filters?: any, limit?: number, offset?: number): Promise<Paged<AuditEvent>>
  insertAudit(event: Omit<AuditEvent, 'id'> & { id?: string; prevHash?: string; hash?: string }): Promise<AuditEvent>

  // Connectors
  listConnectors(): Promise<Connector[]>
  getConnector(app: App): Promise<Connector | null>
  updateConnector(connector: Partial<Connector> & { app: App }): Promise<void>

  // Reviewers
  listReviewers(): Promise<Reviewer[]>
  getReviewerById(id: string): Promise<Reviewer | null>

  // Dev flags
  getDevFlag(key: string): Promise<unknown | null>
  setDevFlag(key: string, value: unknown): Promise<void>

  // Drift summaries
  getDriftSummary(scopeKey: string): Promise<any | null>
  setDriftSummary(scopeKey: string, summary: any): Promise<void>

  // Health
  getCounts(): Promise<{ users: number; entitlements: number; grants: number; snapshots: number; auditEvents: number }>

  // Reset (dev only)
  resetSimulated(): Promise<{ deleted: Record<string, number> }>

  // Live integration: persist sync
  persistSync(
    tenantId: string,
    snapshot: any,
    run: any,
    grants: any[],
    users: any[],
    entitlements: any[],
    audit: any
  ): Promise<{ success: boolean; snapshotId: string; syncRunId: string; tenantId: string }>

  // F-03 Activity Events
  listActivityEvents(filters?: { userId?: string; app?: App; actionClass?: string; from?: string; to?: string; isSimulated?: boolean }, limit?: number, offset?: number): Promise<Paged<ActivityEvent>>
  insertActivityEvents(events: ActivityEvent[]): Promise<number>
  updateActivityEvent(id: string, changes: any): Promise<void>
  deleteActivityEvent(id: string): Promise<void>

  // F-03 Mapping Rules
  listMappingRules(app?: App): Promise<EventMappingRule[]>
  insertMappingRule(rule: EventMappingRule): Promise<EventMappingRule>
  updateMappingRule(id: string, updates: Partial<EventMappingRule>): Promise<EventMappingRule | null>
  deleteMappingRule(id: string): Promise<boolean>

  // F-03 Ingest Runs
  listIngestRuns(app?: App): Promise<IngestRun[]>
  insertIngestRun(run: IngestRun): Promise<IngestRun>
  updateIngestRun(id: string, changes: any): Promise<void>
  deleteIngestRun(id: string): Promise<void>

  // F-03 Usage Summaries
  getUsageSummary(scopeKey: string): Promise<UsageSummary | null>
  saveUsageSummary(scopeKey: string, summary: UsageSummary): Promise<void>
}
