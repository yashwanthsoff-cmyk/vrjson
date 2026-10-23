import type { Evidence } from '@contract'

/**
 * Rule 12: Evidence IDs.
 * - ev-grant-<grantId>
 * - ev-asof-<userId>-<YYYY-MM-DD>
 * - ev-diff-<userId>-<a>-<b>
 * - ev-role-<roleChangeId>
 * - ev-cov-<app>-<YYYY-MM-DD>
 */
export function generateGrantEvidenceId(grantId: string): string {
  return `ev-grant-${grantId}`
}

export function generateAsofEvidenceId(userId: string, date: string): string {
  const datePart = date.slice(0, 10)
  return `ev-asof-${userId}-${datePart}`
}

export function generateDiffEvidenceId(userId: string, a: string, b: string): string {
  const aPart = a.startsWith('snap-') ? a : a.slice(0, 10)
  const bPart = b.startsWith('snap-') ? b : b.slice(0, 10)
  return `ev-diff-${userId}-${aPart}-${bPart}`
}

export function generateRoleEvidenceId(roleChangeId: string): string {
  return `ev-role-${roleChangeId}`
}

export function generateCoverageEvidenceId(app: string, date: string): string {
  const datePart = date.slice(0, 10)
  return `ev-cov-${app}-${datePart}`
}

/**
 * Create derived evidence from grant data.
 */
export function createGrantEvidence(grantId: string, entitlementName: string, app: string, grantedAt: string, removedAt: string | null, source: string, firstSeenSnapshotId: string, lastSeenSnapshotId: string | null): Evidence {
  return {
    id: generateGrantEvidenceId(grantId),
    type: 'grant',
    occurredAt: grantedAt,
    source: `${app} snapshot`,
    payload: {
      grantId,
      userId: grantId.split('-')[1], // Extract from grantId pattern
      entitlementId: grantId.split('-')[2] || 'unknown',
      entitlementName,
      app,
      grantedAt,
      removedAt,
      source,
      firstSeenSnapshotId,
      lastSeenSnapshotId,
    },
    derived: true,
  }
}
