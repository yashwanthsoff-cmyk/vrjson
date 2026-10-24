import type {
  App,
  Entitlement,
  Evidence,
  ExplanationSentence,
  Settings,
  UsageResult,
} from '@contract'

export type SensitivityChip =
  | 'low'
  | 'medium'
  | 'high'
  | 'admin'
  | 'public'
  | 'internal'
  | 'confidential'
  | 'pii_financial'

export type Category = string

export interface ScoreBreakdown {
  severity: number
  sensitivity: number
  evidenceStrength: number
  staleness: number
  weights: {
    severity: number
    sensitivity: number
    evidenceStrength: number
    staleness: number
  }
  finalScore: number
}

export interface ActivityEvent {
  id: string
  userId: string
  app: App
  at: string
  action: string
  resource: string
  actionClass: 'read' | 'write' | 'export' | 'admin'
  isSimulated?: boolean
  ingestRunId?: string | null
  createdAt?: string
}

export interface EventMappingRule {
  id: string
  app: App
  actionPattern: string
  entitlementId: string
  note: string
}

export interface IngestRun {
  id: string
  app: App
  at: string
  windowFrom: string
  windowTo: string
  eventsPulled: number
  unmapped: number
  status: 'completed' | 'failed'
  ingIndex?: number | null
  isSimulated?: boolean
  createdAt?: string
}

export interface ObservationRow {
  userId: string
  app: App
  coverageStart: string
  observedDays: number
  sufficientAdmin: boolean
  sufficientStandard: boolean
}

export interface ActivityRow extends ActivityEvent {
  displayName: string
  pseudonym: string
  mappedEntitlementId?: string | null
  mappedEntitlementName: string | null
  matchedRuleId: string | null
}

export interface MappingRuleView extends EventMappingRule {
  source: 'seed' | 'session'
  edited: boolean
  specificity?: number
  matchCount?: number
}

export interface MappingTestResult {
  app: App
  action: string
  matchedRule: MappingRuleView | null
  entitlementId: string | null
  entitlementName: string | null
  message: string
}

export interface CoverageInfo {
  coveredDays: number
  windowDays: number
  observedDays: number
  coverageDays: number
  text: string
}

export interface RecommendationCardData {
  action: 'keep' | 'review' | 'downgrade' | 'revoke'
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null
  blastRadiusText: string | null
  reasons: string[]
}

export interface UsageRow {
  userId: string
  displayName: string
  pseudonym: string
  app: App
  entitlementId: string
  entitlementName: string
  sensitivityChip: SensitivityChip
  privileged: boolean
  categories: Category[]
  usage: UsageResult
  coverage: CoverageInfo
  guardText: string
  recommendation: RecommendationCardData
  riskScore: number
  scoreBreakdown: ScoreBreakdown
  findingId: string | null
  evidenceIds: string[]
  stale: boolean
  seasonal: boolean
}

export interface UsageEvalRequest {
  settings?: Partial<Settings>
  tags?: Record<string, Partial<Pick<Entitlement, 'privilegeLevel' | 'dataSensitivity' | 'categories'>>>
  deletedRuleIds?: string[]
  addedRules?: Omit<EventMappingRule, 'id'>[]
}

export interface UsageEvalResult {
  rows: UsageRow[]
  counts: { used: number; unused: number; unknown: number }
  changedFindings: { added: number; removed: number; actionChanged: number }
  overlay: { settings: boolean; tags: boolean; rules: boolean }
}

export interface IngestSimulateResult {
  run: IngestRun
  eventsAdded: ActivityRow[]
  unmappedNow: number
  evidence: Evidence[]
  auditEventId: string
  simulatedAt: string
  message: string
}

export interface ObservationRowView extends ObservationRow {
  displayName: string
  pseudonym: string
  coverageDays: number
  windowAdminDays: number
  windowStandardDays: number
}

export interface ValidationResult {
  claims: number
  linked: number
  passed: boolean
  failures: Array<{ claimId: string; reason: string }>
}

export interface UsageSummary {
  id: string
  userId: string
  app: App | null
  source: 'model' | 'template'
  fallbackUsed: boolean
  label: string
  sentences: ExplanationSentence[]
  evidence: Evidence[]
  validation: ValidationResult
  cached: boolean
  createdAt: string
}
