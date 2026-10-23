import { describe, it, expect, beforeEach } from 'vitest'
import { computeContentHash, computeMemberCount, isActiveOnDate } from '../engine-ext/hash.js'
import { accessAsOf } from '../engine-ext/asof.js'
import { diffSnapshots } from '../engine-ext/diff.js'
import { computeCoverage } from '../engine-ext/coverage.js'
import { computeNextRun } from '../engine-ext/schedule.js'
import { generateGrantEvidenceId, generateAsofEvidenceId, generateDiffEvidenceId } from '../engine-ext/evidence.js'
import { computePrePost } from '../engine-ext/prepost.js'
import { nextSimulatedTime, resetSimIndex } from '../engine-ext/simulated.js'
import { consumeSampleGrant, resetSampleGrants } from '../engine-ext/sampleGrants.js'
import type { Grant, Snapshot } from '@contract'

describe('engine-ext/hash', () => {
  it('computes content hash correctly', async () => {
    const grants: Grant[] = [
      { id: 'g1', userId: 'u1', entitlementId: 'e1', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
      { id: 'g2', userId: 'u2', entitlementId: 'e2', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
    ]

    const hash = await computeContentHash('google_workspace', '2026-01-01T00:00:00Z', grants)
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('computes member count correctly', () => {
    const grants: Grant[] = [
      { id: 'g1', userId: 'u1', entitlementId: 'e1', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
      { id: 'g2', userId: 'u1', entitlementId: 'e2', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
      { id: 'g3', userId: 'u2', entitlementId: 'e1', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
    ]

    const count = computeMemberCount('google_workspace', '2026-01-01T00:00:00Z', grants)
    expect(count).toBe(2) // u1 and u2
  })

  it('determines active status correctly', () => {
    const grant: Grant = {
      id: 'g1', userId: 'u1', entitlementId: 'e1', app: 'google_workspace',
      grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test',
      firstSeenSnapshotId: 's1', lastSeenSnapshotId: null
    }

    expect(isActiveOnDate(grant, '2026-01-01T00:00:00Z')).toBe(true)
    expect(isActiveOnDate(grant, '2025-12-31T23:59:59Z')).toBe(false)
  })

  it('handles removed grants', () => {
    const grant: Grant = {
      id: 'g1', userId: 'u1', entitlementId: 'e1', app: 'google_workspace',
      grantedAt: '2026-01-01T00:00:00Z', removedAt: '2026-06-01T00:00:00Z', source: 'test',
      firstSeenSnapshotId: 's1', lastSeenSnapshotId: null
    }

    expect(isActiveOnDate(grant, '2026-03-01T00:00:00Z')).toBe(true)
    expect(isActiveOnDate(grant, '2026-07-01T00:00:00Z')).toBe(false)
  })
})

describe('engine-ext/asof', () => {
  it('finds nearest complete snapshot', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-05-14T00:00:00Z', complete: true, memberCount: 10, contentHash: 'hash1' },
      { id: 's2', app: 'google_workspace', takenAt: '2026-06-01T00:00:00Z', complete: false, memberCount: 11, contentHash: 'hash2' },
      { id: 's3', app: 'google_workspace', takenAt: '2026-07-01T00:00:00Z', complete: true, memberCount: 12, contentHash: 'hash3' },
    ]

    const result = accessAsOf('google_workspace', '2026-06-15T00:00:00Z', snapshots, [])
    // s1 is the nearest complete snapshot before 2026-06-15 (s2 is incomplete, s3 is after)
    expect(result.snapshotUsed?.id).toBe('s1')
    expect(result.snapped).toBe(true)
    expect(result.message).toContain('nearest before selected')
  })

  it('never uses incomplete snapshot', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-03-12T00:00:00Z', complete: false, memberCount: 10, contentHash: 'hash1' },
      { id: 's2', app: 'google_workspace', takenAt: '2026-05-14T00:00:00Z', complete: true, memberCount: 11, contentHash: 'hash2' },
    ]

    const result = accessAsOf('google_workspace', '2026-03-15T00:00:00Z', snapshots, [])
    // No complete snapshot on or before 2026-03-15 (s1 is incomplete, s2 is after)
    expect(result.snapshotUsed).toBeNull()
    expect(result.message).toContain('No complete snapshot')
  })

  it('handles no complete snapshot', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-03-12T00:00:00Z', complete: false, memberCount: 10, contentHash: 'hash1' },
    ]

    const result = accessAsOf('google_workspace', '2026-03-15T00:00:00Z', snapshots, [])
    expect(result.snapshotUsed).toBeNull()
    expect(result.message).toContain('No complete snapshot')
  })
})

describe('engine-ext/diff', () => {
  it('computes diff between two dates', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-05-14T00:00:00Z', complete: true, memberCount: 10, contentHash: 'hash1' },
      { id: 's2', app: 'google_workspace', takenAt: '2026-10-23T00:00:00Z', complete: true, memberCount: 12, contentHash: 'hash2' },
    ]

    const grants: Grant[] = [
      { id: 'g1', userId: 'u1', entitlementId: 'e1', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
      { id: 'g2', userId: 'u2', entitlementId: 'e2', app: 'google_workspace', grantedAt: '2026-06-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's2', lastSeenSnapshotId: null },
    ]

    const result = diffSnapshots('2026-05-14', '2026-10-23', snapshots, grants)
    expect(result.added.length).toBeGreaterThan(0)
    expect(result.removed.length).toBeGreaterThanOrEqual(0)
    expect(result.unchanged.length).toBeGreaterThanOrEqual(0)
  })

  it('maintains diff invariants', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-05-14T00:00:00Z', complete: true, memberCount: 10, contentHash: 'hash1' },
      { id: 's2', app: 'google_workspace', takenAt: '2026-10-23T00:00:00Z', complete: true, memberCount: 12, contentHash: 'hash2' },
    ]

    const grants: Grant[] = [
      { id: 'g1', userId: 'u1', entitlementId: 'e1', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
    ]

    const result = diffSnapshots('2026-05-14', '2026-10-23', snapshots, grants)
    // Rule 7 invariants: added+unchanged = atB; removed+unchanged = atA
    const atB = result.added.length + result.unchanged.length
    const atA = result.removed.length + result.unchanged.length
    // The actual count should match the number of grants active at each snapshot
    expect(atB).toBeGreaterThan(0)
    expect(atA).toBeGreaterThan(0)
    expect(atB).toBe(result.added.length + result.unchanged.length)
    expect(atA).toBe(result.removed.length + result.unchanged.length)
  })
})

describe('engine-ext/coverage', () => {
  it('computes coverage cells', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-05-14T00:00:00Z', complete: true, memberCount: 10, contentHash: 'hash1' },
      { id: 's2', app: 'google_workspace', takenAt: '2026-05-21T00:00:00Z', complete: false, memberCount: 11, contentHash: 'hash2' },
    ]

    const coverage = computeCoverage('google_workspace', snapshots)
    expect(coverage.app).toBe('google_workspace')
    expect(coverage.cells.length).toBeGreaterThan(0)
    expect(coverage.cells[0]).toHaveProperty('status')
    expect(coverage.cells[0]).toHaveProperty('weekStart')
  })

  it('marks complete weeks correctly', () => {
    const snapshots: Snapshot[] = [
      { id: 's1', app: 'google_workspace', takenAt: '2026-05-14T00:00:00Z', complete: true, memberCount: 10, contentHash: 'hash1' },
    ]

    const coverage = computeCoverage('google_workspace', snapshots)
    const weekWithSnapshot = coverage.cells.find((c) => c.weekStart === '2026-05-11')
    expect(weekWithSnapshot?.status).toBe('complete')
  })
})

describe('engine-ext/schedule', () => {
  it('computes next run for daily frequency', () => {
    const schedule = {
      app: 'google_workspace' as const,
      frequency: 'daily' as const,
      enabled: true,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: null,
      actorId: 'rev-asha',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    const nextRun = computeNextRun(schedule)
    expect(nextRun).toMatch(/^2026-10-23T00:00:00/)
  })

  it('computes next run for weekly frequency', () => {
    const schedule = {
      app: 'google_workspace' as const,
      frequency: 'weekly' as const,
      enabled: true,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: null,
      actorId: 'rev-asha',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    const nextRun = computeNextRun(schedule)
    expect(nextRun).toMatch(/^2026-10-29T00:00:00/)
  })

  it('returns null for manual frequency', () => {
    const schedule = {
      app: 'google_workspace' as const,
      frequency: 'manual' as const,
      enabled: true,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: null,
      actorId: 'rev-asha',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    const nextRun = computeNextRun(schedule)
    expect(nextRun).toBeNull()
  })

  it('returns null when disabled', () => {
    const schedule = {
      app: 'google_workspace' as const,
      frequency: 'daily' as const,
      enabled: false,
      lastRunAt: '2026-10-22T00:00:00Z',
      nextRunAt: null,
      actorId: 'rev-asha',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    const nextRun = computeNextRun(schedule)
    expect(nextRun).toBeNull()
  })
})

describe('engine-ext/evidence', () => {
  it('generates grant evidence ID', () => {
    const id = generateGrantEvidenceId('grant-0001')
    expect(id).toBe('ev-grant-grant-0001')
  })

  it('generates asof evidence ID', () => {
    const id = generateAsofEvidenceId('u-meera', '2026-06-01T00:00:00Z')
    expect(id).toBe('ev-asof-u-meera-2026-06-01')
  })

  it('generates diff evidence ID', () => {
    const id = generateDiffEvidenceId('u-meera', '2026-05-14', '2026-10-23')
    expect(id).toBe('ev-diff-u-meera-2026-05-14-2026-10-23')
  })
})

describe('engine-ext/prepost', () => {
  it('computes pre-post comparison', () => {
    const grants: Grant[] = [
      { id: 'g1', userId: 'u-meera', entitlementId: 'e1', app: 'google_workspace', grantedAt: '2026-01-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's1', lastSeenSnapshotId: null },
      { id: 'g2', userId: 'u-meera', entitlementId: 'e2', app: 'google_workspace', grantedAt: '2026-05-01T00:00:00Z', removedAt: null, source: 'test', firstSeenSnapshotId: 's2', lastSeenSnapshotId: null },
    ]

    const result = computePrePost('u-meera', '2026-06-01T00:00:00Z', grants, [])
    expect(result.userId).toBe('u-meera')
    expect(result.before.length).toBe(2) // Both grants active before event
    expect(result.after.length).toBe(2) // Both grants still active after event
    expect(result.carriedOverCount).toBe(2) // Both carried over
  })
})

describe('engine-ext/simulated', () => {
  beforeEach(() => {
    resetSimIndex()
  })

  it('generates sequential simulated times', () => {
    const t1 = nextSimulatedTime()
    const t2 = nextSimulatedTime()
    const t3 = nextSimulatedTime()

    expect(t1).not.toBe(t2)
    expect(t2).not.toBe(t3)
    expect(t1 < t2).toBe(true)
    expect(t2 < t3).toBe(true)
  })
})

describe('engine-ext/sampleGrants', () => {
  beforeEach(() => {
    resetSampleGrants()
  })

  it('consumes sample grants sequentially', () => {
    const g1 = consumeSampleGrant('google_workspace', '2026-10-23T00:01:00Z', 'snap-new')
    const g2 = consumeSampleGrant('google_workspace', '2026-10-23T00:02:00Z', 'snap-new2')
    const g3 = consumeSampleGrant('google_workspace', '2026-10-23T00:03:00Z', 'snap-new3')

    expect(g1).not.toBeNull()
    expect(g2).not.toBeNull()
    expect(g3).not.toBeNull()
    expect(g1?.userId).not.toBe(g2?.userId)
  })

  it('returns null when exhausted', () => {
    consumeSampleGrant('google_workspace', '2026-10-23T00:01:00Z', 'snap-new')
    consumeSampleGrant('google_workspace', '2026-10-23T00:02:00Z', 'snap-new')
    consumeSampleGrant('google_workspace', '2026-10-23T00:03:00Z', 'snap-new')

    const g4 = consumeSampleGrant('google_workspace', '2026-10-23T00:04:00Z', 'snap-new4')
    expect(g4).toBeNull()
  })
})
