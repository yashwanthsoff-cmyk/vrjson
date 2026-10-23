import type { Grant, Snapshot } from '@contract'
import { diffSnapshots } from './diff.js'
import { logger } from '../logger.js'

export interface DriftResult {
  added: Grant[]
  removed: Grant[]
  escalated: Grant[]
  unchanged: Grant[]
  previousSnapshotId: string
  currentSnapshotId: string
}

export interface Finding {
  id: string
  userId: string
  entitlementId: string
  app: string
  type: 'permission_drift' | 'stale_grant' | 'peer_outlier' | 'mover_carryover'
  ruleId: string
  ruleVersion: number
  before?: Grant
  after?: Grant
  riskScore: number
  recommendation: 'keep' | 'review' | 'downgrade' | 'revoke'
  confidence: 'high' | 'medium' | 'low'
  evidenceIds: string[]
  createdFromSnapshotId: string
  previousSnapshotId: string
}

/**
 * Detect drift between two complete snapshots.
 * First sync with no previous complete snapshot creates a BASELINE (no drift findings).
 * Later syncs compare against the previous complete snapshot.
 */
export async function detectDrift(
  previousSnapshot: Snapshot | null,
  currentSnapshot: Snapshot,
  allGrants: Grant[],
  allSnapshots: Snapshot[]
): Promise<DriftResult> {
  if (!previousSnapshot) {
    logger.info('No previous complete snapshot - this is a baseline sync')
    return {
      added: [],
      removed: [],
      escalated: [],
      unchanged: [],
      previousSnapshotId: 'baseline',
      currentSnapshotId: currentSnapshot.id,
    }
  }

  if (!previousSnapshot.complete) {
    logger.warn('Previous snapshot is incomplete - skipping drift detection')
    return {
      added: [],
      removed: [],
      escalated: [],
      unchanged: [],
      previousSnapshotId: previousSnapshot.id,
      currentSnapshotId: currentSnapshot.id,
    }
  }

  if (!currentSnapshot.complete) {
    logger.warn('Current snapshot is incomplete - skipping drift detection')
    return {
      added: [],
      removed: [],
      escalated: [],
      unchanged: [],
      previousSnapshotId: previousSnapshot.id,
      currentSnapshotId: currentSnapshot.id,
    }
  }

  logger.info(
    { previous: previousSnapshot.id, current: currentSnapshot.id },
    'Detecting drift between snapshots'
  )

  const diff = diffSnapshots(previousSnapshot.id, currentSnapshot.id, allSnapshots, allGrants)

  // Detect permission escalations (grants that exist in both but with higher privilege)
  const escalated: Grant[] = []
  const unchanged: Grant[] = []

  for (const grant of diff.unchanged) {
    // Check if the same user-entitlement pair exists with different privilege level
    // This is a simplified check - in reality we'd need to compare entitlement privilege levels
    // For now, we'll treat all unchanged as truly unchanged
    unchanged.push(grant)
  }

  return {
    added: diff.added,
    removed: diff.removed,
    escalated,
    unchanged: diff.unchanged,
    previousSnapshotId: previousSnapshot.id,
    currentSnapshotId: currentSnapshot.id,
  }
}

/**
 * Generate drift findings from drift result.
 * Only create findings for non-baseline syncs.
 */
export function generateDriftFindings(
  drift: DriftResult,
  snapshotId: string
): Finding[] {
  const findings: Finding[] = []

  // Added grants - only if not baseline
  if (drift.previousSnapshotId !== 'baseline') {
    for (const grant of drift.added) {
      findings.push({
        id: `finding-drift-added-${grant.id}`,
        userId: grant.userId,
        entitlementId: grant.entitlementId,
        app: grant.app,
        type: 'permission_drift',
        ruleId: 'drift-added',
        ruleVersion: 1,
        after: grant,
        riskScore: 50,
        recommendation: 'review',
        confidence: 'high',
        evidenceIds: [`evidence-${grant.id}`],
        createdFromSnapshotId: snapshotId,
        previousSnapshotId: drift.previousSnapshotId,
      })
    }
  }

  // Removed grants
  if (drift.previousSnapshotId !== 'baseline') {
    for (const grant of drift.removed) {
      findings.push({
        id: `finding-drift-removed-${grant.id}`,
        userId: grant.userId,
        entitlementId: grant.entitlementId,
        app: grant.app,
        type: 'permission_drift',
        ruleId: 'drift-removed',
        ruleVersion: 1,
        before: grant,
        riskScore: 30,
        recommendation: 'keep',
        confidence: 'high',
        evidenceIds: [`evidence-${grant.id}`],
        createdFromSnapshotId: snapshotId,
        previousSnapshotId: drift.previousSnapshotId,
      })
    }
  }

  // Escalated grants
  if (drift.previousSnapshotId !== 'baseline') {
    for (const grant of drift.escalated) {
      findings.push({
        id: `finding-drift-escalated-${grant.id}`,
        userId: grant.userId,
        entitlementId: grant.entitlementId,
        app: grant.app,
        type: 'permission_drift',
        ruleId: 'drift-escalated',
        ruleVersion: 1,
        before: grant,
        after: grant,
        riskScore: 70,
        recommendation: 'review',
        confidence: 'high',
        evidenceIds: [`evidence-${grant.id}`],
        createdFromSnapshotId: snapshotId,
        previousSnapshotId: drift.previousSnapshotId,
      })
    }
  }

  logger.info({ findingCount: findings.length }, 'Generated drift findings')

  return findings
}
