import type { App, Grant } from '@contract'
import { DEMO_NOW } from '../clock.js'

/**
 * Compute canonical content hash for a snapshot.
 * Rule 4: grants of that app active at takenAt; strings userId|entitlementId;
 * sorted ascending; joined by \n; SHA-256; lowercase hex.
 */
export async function computeContentHash(app: App, takenAt: string, grants: Grant[]): Promise<string> {
  const activeGrants = grants.filter(
    (g) => g.app === app && g.grantedAt <= takenAt && (g.removedAt === null || g.removedAt > takenAt)
  )

  const grantStrings = activeGrants
    .map((g) => `${g.userId}|${g.entitlementId}`)
    .sort((a, b) => a.localeCompare(b))
    .join('\n')

  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(grantStrings))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compute member count (distinct userIds) for a snapshot.
 */
export function computeMemberCount(app: App, takenAt: string, grants: Grant[]): number {
  const activeGrants = grants.filter(
    (g) => g.app === app && g.grantedAt <= takenAt && (g.removedAt === null || g.removedAt > takenAt)
  )
  const distinctUsers = new Set(activeGrants.map((g) => g.userId))
  return distinctUsers.size
}

/**
 * Rule 2: Active on date D.
 * grantedAt <= D AND (removedAt === null OR removedAt > D)
 */
export function isActiveOnDate(grant: Grant, date: string): boolean {
  return grant.grantedAt <= date && (grant.removedAt === null || grant.removedAt > date)
}
