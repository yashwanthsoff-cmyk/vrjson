import { z } from 'zod'
import { syncGitHub } from '../connectors/github/index.js'
import { env } from '../env.js'
import { logger } from '../logger.js'
import type { DataStore } from '../store/DataStore.js'
import { problems } from '../problem.js'
import { randomUUID } from 'crypto'
import { detectDrift, generateDriftFindings } from '../engine-ext/driftDetection.js'

export async function githubSyncRoute(store: DataStore, req: any, res: any) {
  if (env.APP_MODE !== 'live') {
    return res.status(400).json(
      problems.badRequest('GitHub sync is only available in live mode. Set APP_MODE=live.')
    )
  }

  if (!env.GITHUB_TOKEN) {
    return res.status(503).json(
      problems.unavailable('GitHub token not configured. Set GITHUB_TOKEN.')
    )
  }

  // Check if store supports persist_sync (Supabase)
  if (env.STORE !== 'supabase') {
    return res.status(503).json(
      problems.unavailable('GitHub sync requires Supabase store. Set STORE=supabase.')
    )
  }

  try {
    const syncRunId = `sync-${randomUUID()}`
    const snapshotId = `snap-${randomUUID()}`
    const tenantId = 'tenant-default' // Single tenant for prototype

    // Stage 1: Provider fetch
    logger.info({ syncRunId, stage: 'provider_fetch' }, 'Starting GitHub sync')

    const result = await syncGitHub()

    if (!result.success) {
      return res.status(500).json({
        type: 'sync_failed',
        title: 'Sync Failed',
        status: 500,
        detail: result.error || 'GitHub sync failed',
        coverage: result.coverage,
        syncRunId,
        stage: 'provider_fetch',
      })
    }

    // Stage 2: Snapshot persistence
    logger.info({ syncRunId, stage: 'snapshot_persistence' }, 'Persisting sync data')

    const takenAt = new Date().toISOString()
    const contentHash = `sha256:${randomUUID()}` // Simplified hash for prototype

    const snapshot = {
      id: snapshotId,
      app: 'github',
      taken_at: takenAt,
      complete: true,
      member_count: result.counts.users,
      content_hash: contentHash,
      sync_run_id: syncRunId,
      is_simulated: false,
      coverage: result.coverage,
    }

    const run = {
      id: syncRunId,
      app: 'github',
      status: 'completed',
      trigger: 'manual',
      started_at: takenAt,
      completed_at: takenAt,
      grants_added: result.counts.grants,
      grants_removed: 0,
      snapshot_id: snapshotId,
      is_simulated: false,
      sim_index: null,
      created_by: (req as any).actorId || 'system',
      tenant_id: tenantId,
      stage: 'provider_fetch', // Will be updated after drift detection
      coverage: result.coverage,
      error: null,
      counts: result.counts,
      baseline: true, // Will be updated after drift detection
    }

    // Stage 3: Drift detection
    logger.info({ syncRunId, stage: 'drift_detection' }, 'Running drift detection')

    // Get previous complete snapshot
    const snapshots = await store.listSnapshots({ app: 'github' })
    const previousComplete = snapshots.items
      .filter((s: any) => s.complete && s.id !== snapshotId)
      .sort((a: any, b: any) => b.takenAt.localeCompare(a.takenAt))[0] as any

    const drift = await detectDrift(previousComplete, snapshot as any, result.data?.grants || [], snapshots.items)

    // Update run with drift results
    run.stage = 'drift_detection'
    run.baseline = drift.previousSnapshotId === 'baseline'
    run.counts = {
      ...result.counts,
      drift: {
        added: drift.added.length,
        removed: drift.removed.length,
        escalated: drift.escalated.length,
        unchanged: drift.unchanged.length,
      },
    }

    // Generate findings (only if not baseline)
    let findings: any[] = []
    if (drift.previousSnapshotId !== 'baseline') {
      findings = generateDriftFindings(drift, snapshotId)
      logger.info({ findingCount: findings.length }, 'Generated drift findings')
    }

    // Stage 4: AI analysis (placeholder for Phase 6)
    logger.info({ syncRunId, stage: 'ai_analysis' }, 'AI analysis not yet implemented')

    // Finalize run stage
    run.stage = 'completed'

    const audit = {
      id: `audit-${randomUUID()}`,
      at: takenAt,
      actor_id: (req as any).actorId || 'system',
      action: 'sync.completed',
      target_type: 'sync_run',
      target_id: syncRunId,
      detail: `GitHub sync completed. ${result.counts.grants} grants fetched.`,
      prev_hash: '',
      hash: `hash-${randomUUID()}`,
      session_id: (req as any).sessionId || 'system',
      is_simulated: false,
    }

    // Call persist_sync RPC with final run state
    try {
      const persistResult = await (store as any).persistSync(tenantId, snapshot, run, result.data?.grants || [], result.data?.users || [], result.data?.entitlements || [], audit)

      if (!persistResult.success) {
        throw new Error('Persist sync failed')
      }
    } catch (error) {
      logger.error({ error }, 'Persist sync failed')
      return res.status(500).json({
        type: 'sync_failed',
        title: 'Sync Failed',
        status: 500,
        detail: 'Failed to persist sync data',
        syncRunId,
        stage: 'snapshot_persistence',
      })
    }

    res.json({
      success: true,
      syncRunId,
      snapshotId,
      coverage: result.coverage,
      counts: result.counts,
      drift: {
        added: drift.added.length,
        removed: drift.removed.length,
        escalated: drift.escalated.length,
        unchanged: drift.unchanged.length,
        previousSnapshotId: drift.previousSnapshotId,
      },
      findingsGenerated: findings.length,
      stage: 'completed',
      baseline: drift.previousSnapshotId === 'baseline',
    })
  } catch (error) {
    logger.error({ error }, 'GitHub sync route error')
    res.status(500).json(problems.internal())
  }
}

export async function githubStatusRoute(store: DataStore, req: any, res: any) {
  if (!env.GITHUB_TOKEN) {
    return res.json({
      configured: false,
      authenticated: false,
      org: env.GITHUB_ORG || null,
    })
  }

  // Check authentication
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': env.GITHUB_API_VERSION,
      },
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const data = await response.json() as any
      res.json({
        configured: true,
        authenticated: true,
        org: env.GITHUB_ORG || null,
        user: data.login || null,
      })
    } else {
      res.json({
        configured: true,
        authenticated: false,
        org: env.GITHUB_ORG || null,
      })
    }
  } catch (error) {
    res.json({
      configured: true,
      authenticated: false,
      org: env.GITHUB_ORG || null,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
