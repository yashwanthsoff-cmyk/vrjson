import type { DataStore } from '../store/DataStore.js'
import type { App, Grant, Snapshot } from '@contract'
import type { AccessAsOfResult, DiffResult, PrePostComparison } from '../types/extra.js'
import { accessAsOf } from '../engine-ext/asof.js'
import { diffSnapshots } from '../engine-ext/diff.js'
import { computePrePost } from '../engine-ext/prepost.js'

export async function getAccessAsOf(
  store: DataStore,
  userId: string,
  date: string
): Promise<AccessAsOfResult> {
  const [grants, snapshots] = await Promise.all([
    store.listGrants({ userId, removed: false }, 1000, 0),
    store.listSnapshots({}, 1000, 0),
  ])

  const apps = new Set(grants.items.map((g) => g.app))
  const perApp: any[] = []
  const allPermissions: Grant[] = []

  for (const app of apps) {
    const result = accessAsOf(app, date, snapshots.items, grants.items)
    perApp.push(result)

    if (result.snapshotUsed) {
      const appGrants = grants.items.filter(
        (g) => g.app === app && g.grantedAt <= result.snapshotUsed.takenAt && (g.removedAt === null || g.removedAt > result.snapshotUsed.takenAt)
      )
      allPermissions.push(...appGrants)
    }
  }

  return {
    userId,
    requestedDate: date,
    permissions: allPermissions,
    perApp,
  }
}

export async function getDiff(
  store: DataStore,
  userId: string,
  a: string,
  b: string,
  app?: App
): Promise<DiffResult> {
  const [grants, snapshots] = await Promise.all([
    store.listGrants({ userId, app, removed: false }, 1000, 0),
    store.listSnapshots({ app }, 1000, 0),
  ])

  const result = diffSnapshots(a, b, snapshots.items, grants.items)

  // Filter to user's grants
  const userGrants = new Set(grants.items.map((g) => g.id))
  const added = result.added.filter((g) => userGrants.has(g.id))
  const removed = result.removed.filter((g) => userGrants.has(g.id))
  const unchanged = result.unchanged.filter((g) => userGrants.has(g.id))

  return {
    userId,
    a: result.a,
    b: result.b,
    added,
    removed,
    unchanged,
    counts: {
      added: added.length,
      removed: removed.length,
      unchanged: unchanged.length,
      atA: removed.length + unchanged.length,
      atB: added.length + unchanged.length,
    },
  }
}

export async function getBeforeAfter(
  store: DataStore,
  userId: string,
  eventDate?: string
): Promise<PrePostComparison> {
  const [grants, roleChanges] = await Promise.all([
    store.listGrants({ userId, removed: false }, 1000, 0),
    store.listRoleChanges(userId),
  ])

  const effectiveEventDate = eventDate || (roleChanges[0]?.changedAt)

  if (!effectiveEventDate) {
    throw new Error('No role change found for user and no eventDate provided')
  }

  const result = computePrePost(userId, effectiveEventDate, grants.items, roleChanges)

  return result
}
