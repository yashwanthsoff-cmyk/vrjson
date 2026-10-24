export type App = 'google_workspace' | 'microsoft_entra' | 'github'
export type UsageState = 'used' | 'unused' | 'unknown'
export type FindingType = 'unused' | 'stale_grant' | 'peer_outlier' | 'mover_carryover' | 'manual'
export type UiRole = 'reviewer' | 'admin' | 'auditor'
export type FindingStatus = 'open' | 'in_review' | 'handed_off' | 'kept' | 'deferred' | 'justified'
export type Recommendation = 'keep' | 'review' | 'downgrade' | 'revoke'
export type SensitivityChip = 'low' | 'medium' | 'high' | 'admin'

export interface Page<T> { items: T[]; nextCursor: string | null; total: number }
export interface ApiError { code: 'validation' | 'not_found' | 'conflict' | 'forbidden' | 'rate_limited' | 'unavailable' | 'unknown'; message: string; details?: Record<string, string[]> }
export interface User { id: string; displayName: string; pseudonym: string; department: string; title: string; managerId: string | null; employmentType: 'employee' | 'contractor' | 'guest'; startDate: string; seniority: 'junior' | 'mid' | 'senior' | 'lead' }
export interface Entitlement { id: string; app: App; name: string; kind: 'role' | 'group' | 'permission'; privilegeLevel: 'read' | 'write' | 'admin'; dataSensitivity: 'public' | 'internal' | 'confidential' | 'pii_financial'; categories: string[]; seasonal?: boolean; downgradeToId?: string; version: number }
export interface Grant { id: string; userId: string; entitlementId: string; app: App; grantedAt: string; removedAt: string | null; source: string; firstSeenSnapshotId: string; lastSeenSnapshotId: string | null }
export interface Snapshot { id: string; app: App; takenAt: string; complete: boolean; memberCount: number; contentHash: string; syncRunId?: string }
export interface Evidence { id: string; type: 'grant' | 'activity' | 'peer_calc' | 'role_change' | 'coverage'; occurredAt: string; source: string; payload: Record<string, string | number | boolean | null>; derived?: boolean }
export interface Claim { id: string; field: string; value: string | number; evidenceId: string }
export interface ExplanationSentence { id: string; template: string; claims: Claim[] }
export interface UsageResult { state: UsageState; lastUsedAt: string | null; observedDays: number; windowDays: number; evidenceIds: string[]; dormantAccount: boolean; decisionPath: string[] }
export interface Finding { id: string; userId: string; entitlementId: string; app: App; type: FindingType; riskScore: number; recommendation: Recommendation; confidence: 'high' | 'medium' | 'low'; blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null; usage: UsageResult; status: FindingStatus; ownerId: string; dueDate: string; evidenceIds: string[]; version: number }
export interface Decision { id: string; findingId: string; reviewerId: string; decision: string; reasonCode: string; note: string; decidedAt: string; evidenceHash: string; explanationSnapshot: string; supersedesId?: string; handoffPayload?: string }
export interface AuditEvent { id: string; at: string; actorId: string; action: string; targetType: string; targetId: string; detail: string; prevHash: string; hash: string }
export interface Settings { unusedWindowDays: { admin: number; standard: number }; peerThresholdPct: number; minPeerCount: number; graceDays: number; staleGrantDays: number; staleReviewDays: number; blastRadiusMinCoverageDays: number; weights: { severity: number; sensitivity: number; evidenceStrength: number; staleness: number }; detectorsEnabled: Record<FindingType, boolean>; version: number }
