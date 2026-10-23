import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env } from './env.js'
import { logger } from './logger.js'
import { isApiError, problems } from './problem.js'
import type { DataStore } from './store/DataStore.js'
import { asyncHandler } from './routes/asyncHandler.js'

// F-02 route imports
import { healthRoute } from './routes/health.js'
import { inventoryRoute } from './routes/inventory.js'
import { grantsRoute } from './routes/grants.js'
import { snapshotsRoute } from './routes/snapshots.js'
import { accessAsOfRoute } from './routes/accessAsOf.js'
import { diffRoute } from './routes/diff.js'
import { coverageRoute } from './routes/coverage.js'
import { beforeAfterRoute } from './routes/beforeAfter.js'
import { evidenceRoute } from './routes/evidence.js'
import { auditRoute } from './routes/audit.js'
import { syncRunsRoute, scheduleRoute, syncSimulateRoute, scheduleUpdateRoute } from './routes/sync.js'
import { exportDiffCsvRoute } from './routes/export.js'
import { replayCheckRoute } from './routes/replay.js'
import { devFlagsRoute, devResetRoute } from './routes/dev.js'
import { manualFindingsRoute, getManualFindingsRoute } from './routes/findings.js'
import { auditEventRoute } from './routes/auditEvent.js'
import { driftSummaryRoute } from './routes/driftSummary.js'
import { githubSyncRoute, githubStatusRoute } from './routes/github.js'

// F-03 route imports
import { activityRoute, activitySummaryRoute } from './routes/activity.js'
import {
  listMappingRulesRoute,
  testMappingRoute,
  createMappingRuleRoute,
  updateMappingRuleRoute,
  deleteMappingRuleRoute,
} from './routes/mappingRules.js'
import { listIngestRunsRoute } from './routes/ingest.js'
import { ingestSimulateRoute } from './routes/ingestSimulate.js'
import { observationWindowsRoute } from './routes/observation.js'
import {
  listUsageRoute,
  getUsageItemRoute,
  listUsageFindingsRoute,
  evaluateUsageRoute,
} from './routes/usage.js'
import { getRecommendationRoute } from './routes/recommendation.js'
import { getCoverageGuardRoute } from './routes/coverageGuard.js'
import { getTagsRoute, putTagsRoute, deleteTagRoute } from './routes/tags.js'
import {
  getEffectiveSettingsRoute,
  updateEffectiveSettingsRoute,
  resetEffectiveSettingsRoute,
  clearOverlayRoute,
} from './routes/settingsOverlay.js'
import {
  exportActivityCsvRoute,
  exportUsageCsvRoute,
  exportInventoryCsvRoute,
} from './routes/exportF03.js'
import { scenarioChecksF03Route } from './routes/scenariosF03.js'
import { usageSummaryRoute } from './routes/usageSummary.js'

declare global {
  namespace Express {
    interface Request {
      id?: string
      actorId?: string
      sessionId?: string
    }
  }
}

export function createApp(store: DataStore) {
  const app = express()

  // Security middleware
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json({ limit: '100kb' }))

  // Rate limiters
  const driftSummaryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many drift summary requests, please try again later.',
  })

  const usageSummaryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many usage summary requests, please try again later.',
  })

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    res.setHeader('x-request-id', req.id)
    next()
  })

  // Actor and session middleware
  app.use(async (req, res, next) => {
    const actorId = (req.headers['x-actor-id'] as string) || 'rev-asha'
    const sessionId = (req.headers['x-session-id'] as string) || `sess-${Date.now()}`

    req.actorId = actorId
    req.sessionId = sessionId

    const now = new Date().toISOString()
    res.setHeader('x-data-as-of', now)

    next()
  })

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        requestId: req.id,
      })
    })
    next()
  })

  // Health endpoints
  app.get('/health', asyncHandler(async (req, res) => healthRoute(store, req, res)))
  app.get('/api/health', asyncHandler(async (req, res) => healthRoute(store, req, res)))

  // F-02 Read routes
  app.get('/api/inventory', asyncHandler(async (req, res) => inventoryRoute(store, req, res)))
  app.get('/api/grants', asyncHandler(async (req, res) => grantsRoute(store, req, res)))
  app.get('/api/snapshots', asyncHandler(async (req, res) => snapshotsRoute(store, req, res)))
  app.get('/api/access-as-of', asyncHandler(async (req, res) => accessAsOfRoute(store, req, res)))
  app.get('/api/diff', asyncHandler(async (req, res) => diffRoute(store, req, res)))
  app.get('/api/snapshot-coverage', asyncHandler(async (req, res) => coverageRoute(store, req, res)))
  app.get('/api/before-after', asyncHandler(async (req, res) => beforeAfterRoute(store, req, res)))
  app.get('/api/evidence/:id', asyncHandler(async (req, res) => evidenceRoute(store, req, res)))
  app.get('/api/audit', asyncHandler(async (req, res) => auditRoute(store, req, res)))
  app.get('/api/sync-runs', asyncHandler(async (req, res) => syncRunsRoute(store, req, res)))
  app.get('/api/schedule', asyncHandler(async (req, res) => scheduleRoute(store, req, res)))
  app.get('/api/export/diff.csv', asyncHandler(async (req, res) => exportDiffCsvRoute(store, req, res)))

  // F-02 Write routes
  app.post('/api/replay-check', asyncHandler(async (req, res) => replayCheckRoute(store, req, res)))
  app.post('/api/dev/flags', asyncHandler(async (req, res) => devFlagsRoute(store, req, res)))
  app.post('/api/dev/reset', asyncHandler(async (req, res) => devResetRoute(store, req, res)))
  app.post('/api/sync/simulate', asyncHandler(async (req, res) => syncSimulateRoute(store, req, res)))
  app.put('/api/schedule/:app', asyncHandler(async (req, res) => scheduleUpdateRoute(store, req, res)))
  app.post('/api/findings/manual', asyncHandler(async (req, res) => manualFindingsRoute(store, req, res)))
  app.get('/api/findings/manual', asyncHandler(async (req, res) => getManualFindingsRoute(store, req, res)))
  app.post('/api/audit/event', asyncHandler(async (req, res) => auditEventRoute(store, req, res)))
  app.post('/api/drift-summary', driftSummaryLimiter, asyncHandler(async (req, res) => driftSummaryRoute(store, req, res)))

  // GitHub connector routes
  app.post('/api/connectors/github/sync', asyncHandler(async (req, res) => githubSyncRoute(store, req, res)))
  app.get('/api/connectors/github/status', asyncHandler(async (req, res) => githubStatusRoute(store, req, res)))

  // F-03 Routes: Activity
  app.get('/api/activity', asyncHandler(async (req, res) => activityRoute(store, req, res)))
  app.get('/api/activity/summary', asyncHandler(async (req, res) => activitySummaryRoute(store, req, res)))

  // F-03 Routes: Mapping Rules
  app.get('/api/mapping-rules', asyncHandler(async (req, res) => listMappingRulesRoute(store, req, res)))
  app.post('/api/mapping/test', asyncHandler(async (req, res) => testMappingRoute(store, req, res)))
  app.post('/api/mapping-rules', asyncHandler(async (req, res) => createMappingRuleRoute(store, req, res)))
  app.put('/api/mapping-rules/:id', asyncHandler(async (req, res) => updateMappingRuleRoute(store, req, res)))
  app.delete('/api/mapping-rules/:id', asyncHandler(async (req, res) => deleteMappingRuleRoute(store, req, res)))

  // F-03 Routes: Ingest
  app.get('/api/ingest-runs', asyncHandler(async (req, res) => listIngestRunsRoute(store, req, res)))
  app.post('/api/ingest/simulate', asyncHandler(async (req, res) => ingestSimulateRoute(store, req, res)))

  // F-03 Routes: Observation Windows
  app.get('/api/observation-windows', asyncHandler(async (req, res) => observationWindowsRoute(store, req, res)))

  // F-03 Routes: Usage & Findings
  app.get('/api/usage', asyncHandler(async (req, res) => listUsageRoute(store, req, res)))
  app.get('/api/usage/findings', asyncHandler(async (req, res) => listUsageFindingsRoute(store, req, res)))
  app.post('/api/usage/evaluate', asyncHandler(async (req, res) => evaluateUsageRoute(store, req, res)))
  app.get('/api/usage/:userId/:entitlementId', asyncHandler(async (req, res) => getUsageItemRoute(store, req, res)))

  // F-03 Routes: Recommendation & Guard
  app.get('/api/recommendation/:userId/:entitlementId', asyncHandler(async (req, res) => getRecommendationRoute(store, req, res)))
  app.get('/api/coverage-guard/:userId/:entitlementId', asyncHandler(async (req, res) => getCoverageGuardRoute(store, req, res)))

  // F-03 Routes: Tags
  app.get('/api/tags', asyncHandler(async (req, res) => getTagsRoute(store, req, res)))
  app.put('/api/tags', asyncHandler(async (req, res) => putTagsRoute(store, req, res)))
  app.delete('/api/tags', asyncHandler(async (req, res) => deleteTagRoute(store, req, res)))

  // F-03 Routes: Settings & Overlay
  app.get('/api/settings/effective', asyncHandler(async (req, res) => getEffectiveSettingsRoute(store, req, res)))
  app.put('/api/settings/effective', asyncHandler(async (req, res) => updateEffectiveSettingsRoute(store, req, res)))
  app.post('/api/settings/effective', asyncHandler(async (req, res) => updateEffectiveSettingsRoute(store, req, res)))
  app.post('/api/settings/reset', asyncHandler(async (req, res) => resetEffectiveSettingsRoute(store, req, res)))
  app.delete('/api/session/overlay', asyncHandler(async (req, res) => clearOverlayRoute(store, req, res)))

  // F-03 Routes: Exports (CSV)
  app.get('/api/export/activity.csv', asyncHandler(async (req, res) => exportActivityCsvRoute(store, req, res)))
  app.get('/api/export/usage.csv', asyncHandler(async (req, res) => exportUsageCsvRoute(store, req, res)))
  app.get('/api/export/inventory.csv', asyncHandler(async (req, res) => exportInventoryCsvRoute(store, req, res)))

  // F-03 Routes: Scenarios & AI Summary
  app.get('/api/scenario-checks/f03', asyncHandler(async (req, res) => scenarioChecksF03Route(store, req, res)))
  app.post('/api/usage-summary', usageSummaryLimiter, asyncHandler(async (req, res) => usageSummaryRoute(store, req, res)))

  // 404 handler (RFC 7807 problem)
  app.use((req, res) => {
    res.status(404).json({
      type: 'not_found',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${req.path} not found`,
    })
  })

  // Central error handler LAST
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isApiError(err)) {
      logger.warn({ error: err.message, requestId: (req as any).id })
      return res.status(err.status).json(err.toProblem())
    }

    logger.error({ error: err, requestId: (req as any).id })
    res.status(500).json(problems.internal().toProblem())
  })

  return app
}
