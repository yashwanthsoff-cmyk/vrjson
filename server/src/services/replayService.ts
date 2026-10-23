import type { DataStore } from '../store/DataStore.js'
import type { ReplayResult } from '../types/extra.js'
import { runReplayCheck } from '../engine-ext/replay.js'

export async function performReplayCheck(
  store: DataStore,
  snapshotId?: string
): Promise<ReplayResult> {
  const [grants, snapshots, devFlag] = await Promise.all([
    store.listGrants({}, 10000, 0),
    store.listSnapshots({}, 1000, 0),
    store.getDevFlag('corruptSnapshotId'),
  ])

  const corruptSnapshotId = devFlag as string | null | undefined

  // Pass null explicitly if no snapshotId is provided and no dev flag is set
  const effectiveCorruptId = snapshotId || corruptSnapshotId || null

  const result = await runReplayCheck(snapshots.items, grants.items, effectiveCorruptId)

  // Write audit event
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId: 'system',
    action: 'replay.run',
    targetType: 'snapshot',
    targetId: snapshotId || 'all',
    detail: `Replay check on ${result.scope === 'one' ? snapshotId : 'all snapshots'}`,
  })

  return result
}
