import type { App, Grant, Snapshot, Evidence, AuditEvent } from '@contract'
import type { SyncSchedule, SyncRun, RoleChange, Connector, Reviewer, Paged } from '../types/extra.js'
import type {
  ActivityEvent,
  EventMappingRule,
  IngestRun,
  UsageSummary,
} from '../types/extra.f03.js'
import type { DataStore } from './DataStore.js'
import { createClient } from '@supabase/supabase-js'
import { env } from '../env.js'
import { problems } from '../problem.js'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

export class SupabaseStore implements DataStore {
  // Users
  async listUsers(limit = 100, offset = 0): Promise<Paged<any>> {
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (error) throw problems.internal(error.message)
    return { items: data || [], total: count || 0, limit, offset }
  }

  async getUserById(id: string): Promise<any> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw problems.internal(error.message)
    }
    return data
  }

  // Entitlements
  async listEntitlements(limit = 100, offset = 0): Promise<Paged<any>> {
    const { data, error, count } = await supabase
      .from('entitlements')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (error) throw problems.internal(error.message)
    return { items: data || [], total: count || 0, limit, offset }
  }

  async getEntitlementById(id: string): Promise<any> {
    const { data, error } = await supabase.from('entitlements').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data
  }

  // Grants
  async listGrants(filters: any = {}, limit = 100, offset = 0): Promise<Paged<Grant>> {
    let query = supabase.from('grants').select('*', { count: 'exact' })

    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.app) query = query.eq('app', filters.app)
    if (filters.entitlementId) query = query.eq('entitlement_id', filters.entitlementId)
    if (filters.source) query = query.eq('source', filters.source)
    if (filters.activeOn) {
      query = query.lte('granted_at', filters.activeOn).or(`removed_at.is.null,removed_at.gt.${filters.activeOn}`)
    }
    if (filters.removed !== undefined) {
      if (filters.removed) query = query.not('removed_at', 'is', null)
      else query = query.is('removed_at', null)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw problems.internal(error.message)
    return { items: (data as Grant[]) || [], total: count || 0, limit, offset }
  }

  async getGrantById(id: string): Promise<Grant | null> {
    const { data, error } = await supabase.from('grants').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data as Grant
  }

  async insertGrant(grant: Omit<Grant, 'id'> & { id?: string; isSimulated?: boolean; createdAt?: string }): Promise<Grant> {
    const { data, error } = await supabase.from('grants').insert(grant).select().single()
    if (error) throw problems.internal(error.message)
    return data as Grant
  }

  async updateGrantRemovedAt(id: string, removedAt: string | null, lastSeenSnapshotId: string | null): Promise<void> {
    const { error } = await supabase
      .from('grants')
      .update({ removed_at: removedAt, last_seen_snapshot_id: lastSeenSnapshotId })
      .eq('id', id)

    if (error) throw problems.internal(error.message)
  }

  // Snapshots
  async listSnapshots(filters: any = {}, limit = 100, offset = 0): Promise<Paged<Snapshot>> {
    let query = supabase.from('snapshots').select('*', { count: 'exact' })

    if (filters.app) query = query.eq('app', filters.app)
    if (filters.from) query = query.gte('taken_at', filters.from)
    if (filters.to) query = query.lte('taken_at', filters.to)
    if (filters.complete !== undefined) query = query.eq('complete', filters.complete)

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw problems.internal(error.message)
    return { items: (data as Snapshot[]) || [], total: count || 0, limit, offset }
  }

  async getSnapshotById(id: string): Promise<Snapshot | null> {
    const { data, error } = await supabase.from('snapshots').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data as Snapshot
  }

  async insertSnapshot(snapshot: Omit<Snapshot, 'id'> & { id?: string; isSimulated?: boolean; createdAt?: string }): Promise<Snapshot> {
    const { data, error } = await supabase.from('snapshots').insert(snapshot).select().single()
    if (error) throw problems.internal(error.message)
    return data as Snapshot
  }

  async updateSnapshot(id: string, changes: Partial<Snapshot>): Promise<void> {
    throw problems.forbidden('Snapshots are append-only: updates not allowed')
  }

  async deleteSnapshot(id: string): Promise<void> {
    throw problems.forbidden('Snapshots are append-only: deletes not allowed')
  }

  // Evidence
  async getEvidenceById(id: string): Promise<Evidence | null> {
    const { data, error } = await supabase.from('evidence').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data as Evidence
  }

  async listEvidence(evidenceIds: string[]): Promise<Evidence[]> {
    const { data, error } = await supabase.from('evidence').select('*').in('id', evidenceIds)
    if (error) throw problems.internal(error.message)
    return (data as Evidence[]) || []
  }

  async insertEvidence(evidence: Omit<Evidence, 'id'> & { id?: string }): Promise<Evidence> {
    const { data, error } = await supabase.from('evidence').insert(evidence).select().single()
    if (error) throw problems.internal(error.message)
    return data as Evidence
  }

  // Sync
  async listSyncRuns(app?: App): Promise<SyncRun[]> {
    let query = supabase.from('sync_runs').select('*')
    if (app) query = query.eq('app', app)
    const { data, error } = await query.order('started_at', { ascending: false })
    if (error) throw problems.internal(error.message)
    return (data as SyncRun[]) || []
  }

  async insertSyncRun(run: Omit<SyncRun, 'id'> & { id?: string }): Promise<SyncRun> {
    const { data, error } = await supabase.from('sync_runs').insert(run).select().single()
    if (error) throw problems.internal(error.message)
    return data as SyncRun
  }

  async getSyncSchedule(app: App): Promise<SyncSchedule | null> {
    const { data, error } = await supabase.from('sync_schedules').select('*').eq('app', app).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data as SyncSchedule
  }

  async upsertSyncSchedule(schedule: SyncSchedule): Promise<SyncSchedule> {
    const { data, error } = await supabase.from('sync_schedules').upsert(schedule).select().single()
    if (error) throw problems.internal(error.message)
    return data as SyncSchedule
  }

  // Role Changes
  async listRoleChanges(userId?: string): Promise<RoleChange[]> {
    let query = supabase.from('role_changes').select('*')
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query.order('changed_at', { ascending: false })
    if (error) throw problems.internal(error.message)
    return (data as RoleChange[]) || []
  }

  async insertRoleChange(change: Omit<RoleChange, 'id'> & { id?: string }): Promise<RoleChange> {
    const { data, error } = await supabase.from('role_changes').insert(change).select().single()
    if (error) throw problems.internal(error.message)
    return data as RoleChange
  }

  // Audit
  async listAudit(filters: any = {}, limit = 100, offset = 0): Promise<Paged<AuditEvent>> {
    let query = supabase.from('audit_events').select('*', { count: 'exact' })

    if (filters.actorId) query = query.eq('actor_id', filters.actorId)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.targetType) query = query.eq('target_type', filters.targetType)
    if (filters.from) query = query.gte('at', filters.from)
    if (filters.to) query = query.lte('at', filters.to)
    if (filters.q) {
      query = query.or(`detail.ilike.%${filters.q}%,target_id.ilike.%${filters.q}%`)
    }

    query = query.range(offset, offset + limit - 1).order('at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw problems.internal(error.message)
    return { items: (data as AuditEvent[]) || [], total: count || 0, limit, offset }
  }

  async insertAudit(event: Omit<AuditEvent, 'id'> & { id?: string }): Promise<AuditEvent> {
    const { data, error } = await supabase.from('audit_events').insert(event).select().single()
    if (error) throw problems.internal(error.message)
    return data as AuditEvent
  }

  // Connectors
  async listConnectors(): Promise<Connector[]> {
    const { data, error } = await supabase.from('connectors').select('*')
    if (error) throw problems.internal(error.message)
    return (data as Connector[]) || []
  }

  async getConnector(app: App): Promise<Connector | null> {
    const { data, error } = await supabase.from('connectors').select('*').eq('app', app).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data as Connector
  }

  async updateConnector(connector: Partial<Connector> & { app: App }): Promise<void> {
    const { error } = await supabase.from('connectors').update(connector).eq('app', connector.app)
    if (error) throw problems.internal(error.message)
  }

  // Reviewers
  async listReviewers(): Promise<Reviewer[]> {
    const { data, error } = await supabase.from('reviewers').select('*')
    if (error) throw problems.internal(error.message)
    return (data as Reviewer[]) || []
  }

  async getReviewerById(id: string): Promise<Reviewer | null> {
    const { data, error } = await supabase.from('reviewers').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data as Reviewer
  }

  // Dev flags
  async getDevFlag(key: string): Promise<unknown | null> {
    const { data, error } = await supabase.from('dev_flags').select('value').eq('key', key).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data?.value || null
  }

  async setDevFlag(key: string, value: unknown): Promise<void> {
    const { error } = await supabase.from('dev_flags').upsert({ key, value }, { onConflict: 'key' })
    if (error) throw problems.internal(error.message)
  }

  // Drift summaries
  async getDriftSummary(scopeKey: string): Promise<any | null> {
    const { data, error } = await supabase.from('drift_summaries').select('*').eq('scope_key', scopeKey).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }
    return data || null
  }

  async setDriftSummary(scopeKey: string, summary: any): Promise<void> {
    const { error } = await supabase.from('drift_summaries').upsert({
      id: `ds-${Date.now()}`,
      scope_key: scopeKey,
      ...summary,
    }, { onConflict: 'scope_key' })
    if (error) throw problems.internal(error.message)
  }

  // Health
  async getCounts(): Promise<{ users: number; entitlements: number; grants: number; snapshots: number; auditEvents: number }> {
    const [users, entitlements, grants, snapshots, audit] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('entitlements').select('*', { count: 'exact', head: true }),
      supabase.from('grants').select('*', { count: 'exact', head: true }),
      supabase.from('snapshots').select('*', { count: 'exact', head: true }),
      supabase.from('audit_events').select('*', { count: 'exact', head: true }),
    ])

    return {
      users: users.count || 0,
      entitlements: entitlements.count || 0,
      grants: grants.count || 0,
      snapshots: snapshots.count || 0,
      auditEvents: audit.count || 0,
    }
  }

  // Reset (dev only)
  async resetSimulated(): Promise<{ deleted: Record<string, number> }> {
    const { data, error } = await supabase.rpc('dev_reset_simulated')
    if (error) throw problems.internal(error.message)
    return { deleted: data as Record<string, number> }
  }

  // F-03 Activity Events
  async listActivityEvents(
    filters: { userId?: string; app?: App; actionClass?: string; from?: string; to?: string; isSimulated?: boolean } = {},
    limit = 100,
    offset = 0
  ): Promise<Paged<ActivityEvent>> {
    let query = supabase.from('activity_events').select('*', { count: 'exact' })

    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.app) query = query.eq('app', filters.app)
    if (filters.actionClass) query = query.eq('action_class', filters.actionClass)
    if (filters.from) query = query.gte('at', filters.from)
    if (filters.to) query = query.lte('at', filters.to)
    if (filters.isSimulated !== undefined) query = query.eq('is_simulated', filters.isSimulated)

    const { data, error, count } = await query
      .order('at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw problems.internal(error.message)

    const items = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      app: row.app,
      at: row.at,
      action: row.action,
      resource: row.resource,
      actionClass: row.action_class,
      isSimulated: row.is_simulated,
      ingestRunId: row.ingest_run_id,
      createdAt: row.created_at,
    }))

    return { items, total: count || 0, limit, offset }
  }

  async insertActivityEvents(events: ActivityEvent[]): Promise<number> {
    if (events.length === 0) return 0
    const records = events.map((ev) => ({
      id: ev.id,
      user_id: ev.userId,
      app: ev.app,
      at: ev.at,
      action: ev.action,
      resource: ev.resource,
      action_class: ev.actionClass,
      is_simulated: ev.isSimulated ?? false,
      ingest_run_id: ev.ingestRunId ?? null,
      created_at: ev.createdAt || ev.at,
    }))

    const { error } = await supabase.from('activity_events').insert(records)
    if (error) throw problems.internal(error.message)
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
    let query = supabase.from('event_mapping_rules').select('*')
    if (app) query = query.eq('app', app)
    const { data, error } = await query
    if (error) throw problems.internal(error.message)

    return (data || []).map((row: any) => ({
      id: row.id,
      app: row.app,
      actionPattern: row.action_pattern,
      entitlementId: row.entitlement_id,
      note: row.note,
    }))
  }

  async insertMappingRule(rule: EventMappingRule): Promise<EventMappingRule> {
    const record = {
      id: rule.id,
      app: rule.app,
      action_pattern: rule.actionPattern,
      entitlement_id: rule.entitlementId,
      note: rule.note,
    }
    const { error } = await supabase.from('event_mapping_rules').insert(record)
    if (error) throw problems.internal(error.message)
    return rule
  }

  async updateMappingRule(
    id: string,
    updates: Partial<EventMappingRule>
  ): Promise<EventMappingRule | null> {
    const updateRecord: any = {}
    if (updates.actionPattern) updateRecord.action_pattern = updates.actionPattern
    if (updates.entitlementId) updateRecord.entitlement_id = updates.entitlementId
    if (updates.note !== undefined) updateRecord.note = updates.note

    const { data, error } = await supabase
      .from('event_mapping_rules')
      .update(updateRecord)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }

    return {
      id: data.id,
      app: data.app,
      actionPattern: data.action_pattern,
      entitlementId: data.entitlement_id,
      note: data.note,
    }
  }

  async deleteMappingRule(id: string): Promise<boolean> {
    const { error } = await supabase.from('event_mapping_rules').delete().eq('id', id)
    if (error) throw problems.internal(error.message)
    return true
  }

  // F-03 Ingest Runs
  async listIngestRuns(app?: App): Promise<IngestRun[]> {
    let query = supabase.from('ingest_runs').select('*').order('at', { ascending: false })
    if (app) query = query.eq('app', app)
    const { data, error } = await query
    if (error) throw problems.internal(error.message)

    return (data || []).map((row: any) => ({
      id: row.id,
      app: row.app,
      at: row.at,
      windowFrom: row.window_from,
      windowTo: row.window_to,
      eventsPulled: row.events_pulled,
      unmapped: row.unmapped,
      status: row.status,
      ingIndex: row.ing_index,
      isSimulated: row.is_simulated,
      createdAt: row.created_at,
    }))
  }

  async insertIngestRun(run: IngestRun): Promise<IngestRun> {
    const record = {
      id: run.id,
      app: run.app,
      at: run.at,
      window_from: run.windowFrom,
      window_to: run.windowTo,
      events_pulled: run.eventsPulled,
      unmapped: run.unmapped,
      status: run.status,
      ing_index: run.ingIndex ?? null,
      is_simulated: run.isSimulated ?? false,
      created_at: run.createdAt || run.at,
    }
    const { error } = await supabase.from('ingest_runs').insert(record)
    if (error) throw problems.internal(error.message)
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
    const { data, error } = await supabase
      .from('usage_summaries')
      .select('*')
      .eq('scope_key', scopeKey)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw problems.internal(error.message)
    }

    return {
      id: data.id,
      userId: data.user_id,
      app: data.app,
      source: data.source,
      fallbackUsed: data.source === 'template',
      label: data.source === 'model'
        ? 'Wording generated by gpt-oss via Groq, validated against evidence. Facts are computed by transparent rules.'
        : 'Fixed template wording.',
      sentences: data.wording?.sentences || [],
      evidence: [],
      validation: data.validation || { claims: 0, linked: 0, passed: true, failures: [] },
      cached: true,
      createdAt: data.created_at,
    }
  }

  async saveUsageSummary(scopeKey: string, summary: UsageSummary): Promise<void> {
    const record = {
      id: summary.id,
      scope_key: scopeKey,
      user_id: summary.userId,
      app: summary.app,
      source: summary.source,
      wording: { sentences: summary.sentences },
      validation: summary.validation,
      is_simulated: false,
      created_at: summary.createdAt,
    }

    const { error } = await supabase.from('usage_summaries').upsert(record, { onConflict: 'scope_key' })
    if (error) throw problems.internal(error.message)
  }
}
