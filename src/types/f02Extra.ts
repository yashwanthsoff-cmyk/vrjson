// F-02 additional types not in contract.ts

export interface AccessAsOfResult {
  perApp: Array<{
    app: string
    snapshotUsed: {
      id: string
      date: string
    } | null
    snapped: boolean
    message?: string
    grants: Array<{
      entitlementId: string
      entitlementName: string
      source: string
    }>
  }>
}

export interface DiffResult {
  added: Array<{ entitlementId: string; entitlementName: string; source: string }>
  removed: Array<{ entitlementId: string; entitlementName: string; source: string }>
  unchanged: Array<{ entitlementId: string; entitlementName: string; source: string }>
  counts: {
    atA: number
    atB: number
  }
}

export interface ReplayResult {
  scope: 'one' | 'all'
  passed: number
  failed: number
  skippedIncomplete: number
  failingSnapshotIds: string[]
}

export interface BeforeAfterResult {
  removedAtMove: Array<{ entitlementId: string; entitlementName: string }>
  carriedOver: Array<{ entitlementId: string; entitlementName: string }>
  addedAfter: Array<{ entitlementId: string; entitlementName: string }>
}

export interface DriftSummaryResult {
  sentences: Array<{
    text: string
    evidenceIds: string[]
  }>
  validation: {
    claimsLinked: number
    totalClaims: number
  }
  source: 'model' | 'template'
  fallbackUsed: boolean
  cached: boolean
  label: string
}
