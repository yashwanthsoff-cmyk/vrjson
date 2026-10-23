import type { App, Grant } from '@contract'
import sampleSyncGrants from '../seed/sampleSyncGrants.json' assert { type: 'json' }

const appMapping: Record<string, App> = {
  'google_workspace': 'google_workspace',
  'microsoft_entra': 'microsoft_entra',
  'github': 'github',
}

// Track used sample grants per app
const usedSamples = new Map<App, Set<string>>()

/**
 * Rule 11: Sample grants.
 * withChange=true consumes the next unused sample for that app.
 * Returns null if exhausted.
 */
export function consumeSampleGrant(app: App, simulatedAt: string, firstSeenSnapshotId: string): Omit<Grant, 'id'> | null {
  const samples = sampleSyncGrants[app as keyof typeof sampleSyncGrants] as Array<{ userId: string; entitlementId: string }>
  if (!samples) return null

  if (!usedSamples.has(app)) {
    usedSamples.set(app, new Set())
  }

  const used = usedSamples.get(app)!

  // Find the first unused sample
  for (const sample of samples) {
    const key = `${sample.userId}-${sample.entitlementId}`
    if (!used.has(key)) {
      used.add(key)
      return {
        userId: sample.userId,
        entitlementId: sample.entitlementId,
        app,
        grantedAt: simulatedAt,
        removedAt: null,
        source: 'directory_sync',
        firstSeenSnapshotId,
        lastSeenSnapshotId: null,
      }
    }
  }

  return null // Exhausted
}

export function resetSampleGrants(): void {
  usedSamples.clear()
}

export function getUsedSampleCount(app: App): number {
  return usedSamples.get(app)?.size || 0
}
