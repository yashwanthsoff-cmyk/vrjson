import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import type { SnapshotCoverage } from '../types/extra.js'
import { computeCoverage } from '../engine-ext/coverage.js'

export async function getSnapshotCoverage(store: DataStore): Promise<SnapshotCoverage[]> {
  const snapshots = await store.listSnapshots({}, 1000, 0)

  const apps = new Set(snapshots.items.map((s) => s.app))
  const coverage: SnapshotCoverage[] = []

  for (const app of apps) {
    coverage.push(computeCoverage(app as App, snapshots.items))
  }

  return coverage
}
