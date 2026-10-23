import type { DataStore } from '../store/DataStore.js'
import type { Evidence, Finding } from '@contract'
import { generateGrantEvidenceId } from '../engine-ext/evidence.js'

export async function createManualFinding(
  store: DataStore,
  userId: string,
  entitlementId: string,
  grantId: string | null,
  actorId: string
): Promise<{ finding: any; evidence: Evidence[] }> {
  // Check for duplicate (simplified - in real implementation would check manual_findings table)
  // For now, just proceed

  // Generate evidence for the grant
  const evidence: Evidence[] = []
  if (grantId) {
    const grant = await store.getGrantById(grantId)
    if (grant) {
      const ev = await store.insertEvidence({
        id: generateGrantEvidenceId(grant.id),
        type: 'grant',
        occurredAt: grant.grantedAt,
        source: grant.source,
        payload: {
          grantId: grant.id,
          userId: grant.userId,
          entitlementId: grant.entitlementId,
          app: grant.app,
          grantedAt: grant.grantedAt,
          removedAt: grant.removedAt,
          source: grant.source,
          firstSeenSnapshotId: grant.firstSeenSnapshotId,
          lastSeenSnapshotId: grant.lastSeenSnapshotId,
        },
        derived: false,
      })

      evidence.push(ev)
    }
  }

  // Create finding with simple explanation
  const finding = {
    id: `finding-${Date.now()}`,
    userId,
    entitlementId,
    grantId,
    type: 'manual' as const,
    status: 'open' as const,
    recommendedAction: 'review' as const,
    confidence: 'low' as const,
    blastRadius: null,
    explanation: {
      sentences: [
        {
          id: 's1',
          template: 'Manual finding flagged for review.',
          claims: [],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    createdBy: actorId,
  }

  // In a real implementation, this would go to manual_findings table
  // For now, we'll just return it

  // Write audit event
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId,
    action: 'finding.flagged_manual',
    targetType: 'finding',
    targetId: finding.id,
    detail: `Manual finding created for user ${userId}, entitlement ${entitlementId}`,
    prevHash: '',
    hash: '',
  } as any)

  return { finding, evidence }
}

export async function getManualFindings(store: DataStore): Promise<{ findings: any[]; evidence: Evidence[] }> {
  // In a real implementation, this would query the manual_findings table
  // For now, return empty
  return { findings: [], evidence: [] }
}
