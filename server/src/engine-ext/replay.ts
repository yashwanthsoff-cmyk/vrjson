import type { Grant, Snapshot } from '@contract'
import type { ReplayResult } from '../types/extra.js'
import { computeContentHash } from './hash.js'

/**
 * Rule 13: Replay check.
 * Every COMPLETE snapshot is rebuilt with rule 4 and compared to the stored hash.
 * Incomplete snapshots go to skippedIncomplete.
 * Dev flag corruptSnapshotId alters the stored hash AT READ TIME only.
 */
export async function runReplayCheck(
  snapshots: Snapshot[],
  grants: Grant[],
  corruptSnapshotId?: string | null
): Promise<ReplayResult> {
  let checked = 0
  let passed = 0
  const failed: string[] = []
  const skippedIncomplete: string[] = []

  // If corruptSnapshotId is null, don't auto-corrupt
  // If corruptSnapshotId is undefined, pick the complete Google snapshot nearest 2026-07-01
  let effectiveCorruptId = corruptSnapshotId
  if (corruptSnapshotId === undefined) {
    const googleSnaps = snapshots
      .filter((s) => s.app === 'google_workspace' && s.complete)
      .sort((a, b) => Math.abs(new Date(a.takenAt).getTime() - new Date('2026-07-01').getTime()) - Math.abs(new Date(b.takenAt).getTime() - new Date('2026-07-01').getTime()))
    if (googleSnaps.length > 0) {
      effectiveCorruptId = googleSnaps[0].id
    }
  }

  for (const snapshot of snapshots) {
    if (!snapshot.complete) {
      skippedIncomplete.push(snapshot.id)
      continue
    }

    checked++

    // Recompute hash
    const recomputedHash = await computeContentHash(snapshot.app, snapshot.takenAt, grants)

    // Apply corruption if configured
    let storedHash = snapshot.contentHash
    if (effectiveCorruptId === snapshot.id) {
      // Corrupt by changing the last character
      storedHash = storedHash.slice(0, -1) + (storedHash.slice(-1) === 'a' ? 'b' : 'a')
    }

    if (recomputedHash === storedHash) {
      passed++
    } else {
      failed.push(snapshot.id)
    }
  }

  return {
    scope: corruptSnapshotId ? 'one' : 'all',
    checked,
    passed,
    failed: failed.length,
    skippedIncomplete,
    failingSnapshotIds: failed,
    ranAt: new Date().toISOString(),
  }
}
