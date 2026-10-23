import type { DataStore } from '../store/DataStore.js'
import type { App, Grant, Snapshot, Evidence } from '@contract'
import type { SyncSimulateResult, SyncRun, SyncSchedule } from '../types/extra.js'
import { computeContentHash, computeMemberCount } from '../engine-ext/hash.js'
import { computeNextRun } from '../engine-ext/schedule.js'
import { nextSimulatedTime, getCurrentSimIndex, resetSimIndex } from '../engine-ext/simulated.js'
import { consumeSampleGrant, resetSampleGrants } from '../engine-ext/sampleGrants.js'
import { generateGrantEvidenceId } from '../engine-ext/evidence.js'
import { problems } from '../problem.js'
import { env } from '../env.js'
import { AsyncMutex } from '../mutex.js'

const syncMutex = new AsyncMutex()

export async function simulateSync(
  store: DataStore,
  app: App,
  withChange: boolean,
  actorId: string
): Promise<SyncSimulateResult> {
  // Check connector error flag
  const devFlags = await store.getDevFlag('simulateConnectorError')
  const connectorErrors = devFlags as Record<string, boolean> | null
  if (connectorErrors?.[app]) {
    throw problems.unavailable(`Connector unavailable. Data frozen as of ${new Date().toISOString()}.`)
  }

  // Check if connector is revoked
  const connector = await store.getConnector(app)
  if (connector?.status === 'revoked') {
    throw problems.conflict('Connector is revoked')
  }

  // Use mutex to prevent concurrent sync simulations
  const release = await syncMutex.acquire()

  try {
    const simulatedAt = nextSimulatedTime()
    const simIndex = getCurrentSimIndex()

    // Get current grants and snapshots
    const [grants, snapshots, entitlements, users] = await Promise.all([
      store.listGrants({ app, removed: false }, 10000, 0),
      store.listSnapshots({ app }, 1000, 0),
      store.listEntitlements(1000, 0),
      store.listUsers(1000, 0),
    ])

    // Consume sample grant if withChange is true
    let addedGrants: Grant[] = []
    if (withChange) {
      const sampleGrant = consumeSampleGrant(app, simulatedAt, `snap-${app}-${simIndex}`)
      if (!sampleGrant) {
        throw problems.conflict('No more sample changes for this app.')
      }

      // Insert the new grant
      const newGrant = await store.insertGrant({
        ...sampleGrant,
        id: `grant-${Date.now()}`,
        isSimulated: true,
        createdAt: simulatedAt,
      } as any)

      addedGrants.push(newGrant)
    }

    // Compute new snapshot hash
    const allGrants = [...grants.items, ...addedGrants]
    const contentHash = await computeContentHash(app, simulatedAt, allGrants)
    const memberCount = computeMemberCount(app, simulatedAt, allGrants)

    // Create snapshot
    const snapshot = await store.insertSnapshot({
      id: `snap-${app}-${simIndex}`,
      app,
      takenAt: simulatedAt,
      complete: true,
      memberCount,
      contentHash,
      isSimulated: true,
      createdAt: simulatedAt,
    } as any)

    // Create sync run
    const syncRun = await store.insertSyncRun({
      id: `sync-${app}-${simIndex}`,
      app,
      status: 'ok',
      trigger: 'manual',
      startedAt: simulatedAt,
      completedAt: simulatedAt,
      grantsAdded: addedGrants.length,
      grantsRemoved: 0,
      snapshotId: snapshot.id,
      isSimulated: true,
      simIndex,
      createdBy: actorId,
    } as any)

    // Generate evidence for added grants
    const evidence: Evidence[] = []
    for (const grant of addedGrants) {
      const user = users.items.find((u) => u.id === grant.userId)
      const entitlement = entitlements.items.find((e) => e.id === grant.entitlementId)

      if (user && entitlement) {
        const ev = await store.insertEvidence({
          id: generateGrantEvidenceId(grant.id),
          type: 'grant',
          occurredAt: simulatedAt,
          source: 'directory_sync',
          payload: {
            grantId: grant.id,
            userId: grant.userId,
            entitlementId: grant.entitlementId,
            entitlementName: entitlement.name,
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

    // Update schedule
    const currentSchedule = await store.getSyncSchedule(app)
    if (currentSchedule) {
      const updatedSchedule: SyncSchedule = {
        ...currentSchedule,
        lastRunAt: simulatedAt,
        nextRunAt: computeNextRun({
          ...currentSchedule,
          lastRunAt: simulatedAt,
        }),
        updatedAt: simulatedAt,
        actorId,
      }

      await store.upsertSyncSchedule(updatedSchedule)
    }

    // Write audit event
    const auditEvent = await store.insertAudit({
      at: simulatedAt,
      actorId,
      action: 'sync.run',
      targetType: 'sync',
      targetId: syncRun.id,
      detail: 'Simulated. No connected app was contacted.',
      prevHash: '',
      hash: '',
    } as any)

    return {
      snapshot,
      syncRun,
      addedGrants,
      evidence,
      auditEventId: auditEvent.id,
      simulatedAt,
      message: `Simulated sync completed. ${addedGrants.length} grants added.`,
    }
  } finally {
    release()
  }
}

export async function updateSchedule(
  store: DataStore,
  app: App,
  frequency: 'daily' | 'weekly' | 'manual',
  enabled: boolean,
  actorId: string
): Promise<SyncSchedule> {
  const currentSchedule = await store.getSyncSchedule(app)

  const schedule: SyncSchedule = {
    app,
    frequency,
    enabled,
    lastRunAt: currentSchedule?.lastRunAt || null,
    nextRunAt: currentSchedule ? computeNextRun({ ...currentSchedule, frequency, enabled }) : null,
    actorId,
    updatedAt: new Date().toISOString(),
  }

  const updated = await store.upsertSyncSchedule(schedule)

  // Write audit event
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId,
    action: 'schedule.updated',
    targetType: 'schedule',
    targetId: app,
    detail: `Schedule updated to ${frequency}, enabled: ${enabled}`,
    prevHash: '',
    hash: '',
  } as any)

  return updated
}
