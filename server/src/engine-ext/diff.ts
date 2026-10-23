import type { App, Grant, Snapshot } from '@contract'
import type { AccessAsOfApp, DiffSide } from '../types/extra.js'
import { accessAsOf } from './asof.js'

/**
 * Resolve a reference (date or snapshot id) to per-app access.
 */
function resolveRef(
  ref: string,
  snapshots: Snapshot[],
  grants: Grant[]
): DiffSide {
  // Check if it's a snapshot id (starts with 'snap-')
  if (ref.startsWith('snap-')) {
    const snapshot = snapshots.find((s) => s.id === ref)
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${ref}`)
    }

    const perApp: AccessAsOfApp[] = []
    const apps = new Set(snapshots.map((s) => s.app))

    for (const app of apps) {
      const appSnapshots = snapshots.filter((s) => s.app === app && s.complete && s.takenAt <= snapshot.takenAt)
      const nearest = appSnapshots.sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]

      if (nearest) {
        const activeGrants = grants.filter(
          (g) => g.app === app && g.grantedAt <= nearest.takenAt && (g.removedAt === null || g.removedAt > nearest.takenAt)
        )

        perApp.push({
          app,
          requestedDate: ref,
          effectiveDate: nearest.takenAt,
          snapshotUsed: nearest,
          snapped: nearest.takenAt !== snapshot.takenAt,
          message: nearest.takenAt !== snapshot.takenAt
            ? `Showing snapshot of ${nearest.takenAt.slice(0, 10)} (nearest before selected).`
            : `Showing snapshot of ${nearest.takenAt.slice(0, 10)}.`,
        })
      }
    }

    return { ref, perApp }
  }

  // Otherwise, treat as a date
  const apps = new Set(snapshots.map((s) => s.app))
  const perApp: AccessAsOfApp[] = []

  for (const app of apps) {
    perApp.push(accessAsOf(app, ref, snapshots, grants))
  }

  return { ref, perApp }
}

/**
 * Rule 7: Diff between two references (dates or snapshot ids).
 * Resolve both via rule 6 per app, then compare by grant id.
 */
export function diffSnapshots(
  a: string,
  b: string,
  snapshots: Snapshot[],
  grants: Grant[]
): { a: DiffSide; b: DiffSide; added: Grant[]; removed: Grant[]; unchanged: Grant[] } {
  const sideA = resolveRef(a, snapshots, grants)
  const sideB = resolveRef(b, snapshots, grants)

  // Collect all grants at each point
  const grantsAtA = new Set<string>()
  const grantsAtB = new Set<string>()

  sideA.perApp.forEach((appInfo) => {
    const snapshot = appInfo.snapshotUsed
    if (snapshot) {
      grants
        .filter((g) => g.app === appInfo.app && g.grantedAt <= snapshot.takenAt && (g.removedAt === null || g.removedAt > snapshot.takenAt))
        .forEach((g) => grantsAtA.add(g.id))
    }
  })

  sideB.perApp.forEach((appInfo) => {
    const snapshot = appInfo.snapshotUsed
    if (snapshot) {
      grants
        .filter((g) => g.app === appInfo.app && g.grantedAt <= snapshot.takenAt && (g.removedAt === null || g.removedAt > snapshot.takenAt))
        .forEach((g) => grantsAtB.add(g.id))
    }
  })

  const allGrants = grants.filter((g) => grantsAtA.has(g.id) || grantsAtB.has(g.id))

  const added: Grant[] = []
  const removed: Grant[] = []
  const unchanged: Grant[] = []

  allGrants.forEach((grant) => {
    const inA = grantsAtA.has(grant.id)
    const inB = grantsAtB.has(grant.id)

    if (inA && !inB) {
      removed.push(grant)
    } else if (!inA && inB) {
      added.push(grant)
    } else if (inA && inB) {
      unchanged.push(grant)
    }
  })

  return {
    a: sideA,
    b: sideB,
    added,
    removed,
    unchanged,
  }
}
