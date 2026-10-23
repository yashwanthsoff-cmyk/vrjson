import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env } from './env.js'
import { logger } from './logger.js'
import { isApiError, problems } from './problem.js'
import { MemoryStore } from './store/MemoryStore.js'
import { SupabaseStore } from './store/SupabaseStore.js'
import type { DataStore } from './store/DataStore.js'
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

// Type assertion for Express request extension
declare global {
  namespace Express {
    interface Request {
      id?: string
    }
  }
}

export function createApp(store: DataStore) {
  const app = express()

  // Security middleware
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json({ limit: '100kb' }))

  // Rate limit for drift-summary
  const driftSummaryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many drift summary requests, please try again later.',
  })

  // Request ID middleware
  app.use((req, res, next) => {
    ;(req as any).id = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    res.setHeader('x-request-id', (req as any).id)
    next()
  })

  // Actor and session middleware
  app.use(async (req, res, next) => {
    const actorId = (req.headers['x-actor-id'] as string) || 'rev-asha' // Default to Asha Rao
    const sessionId = (req.headers['x-session-id'] as string) || `sess-${Date.now()}`

    ;(req as any).actorId = actorId
    ;(req as any).sessionId = sessionId

    // Set x-data-as-of header (last good sync time - using current time for now)
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

  // Health endpoint
  app.get('/health', async (req, res, next) => {
    try {
      await healthRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/health', async (req, res, next) => {
    try {
      await healthRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  // Read routes - static imports
  app.get('/api/inventory', async (req, res, next) => {
    try {
      await inventoryRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/grants', async (req, res, next) => {
    try {
      await grantsRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/snapshots', async (req, res, next) => {
    try {
      await snapshotsRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/access-as-of', async (req, res, next) => {
    try {
      await accessAsOfRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/diff', async (req, res, next) => {
    try {
      await diffRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/snapshot-coverage', async (req, res, next) => {
    try {
      await coverageRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/before-after', async (req, res, next) => {
    try {
      await beforeAfterRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/evidence/:id', async (req, res, next) => {
    try {
      await evidenceRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/audit', async (req, res, next) => {
    try {
      await auditRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/sync-runs', async (req, res, next) => {
    try {
      await syncRunsRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/schedule', async (req, res, next) => {
    try {
      await scheduleRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/export/diff.csv', async (req, res, next) => {
    try {
      await exportDiffCsvRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  // Write routes
  app.post('/api/replay-check', async (req, res, next) => {
    try {
      await replayCheckRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.post('/api/dev/flags', async (req, res, next) => {
    try {
      await devFlagsRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.post('/api/dev/reset', async (req, res, next) => {
    try {
      await devResetRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.post('/api/sync/simulate', async (req, res, next) => {
    try {
      await syncSimulateRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.put('/api/schedule/:app', async (req, res, next) => {
    try {
      await scheduleUpdateRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.post('/api/findings/manual', async (req, res, next) => {
    try {
      await manualFindingsRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/findings/manual', async (req, res, next) => {
    try {
      await getManualFindingsRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.post('/api/audit/event', async (req, res, next) => {
    try {
      await auditEventRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.post('/api/drift-summary', driftSummaryLimiter, async (req, res, next) => {
    try {
      await driftSummaryRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  // GitHub connector routes
  app.post('/api/connectors/github/sync', async (req, res, next) => {
    try {
      await githubSyncRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  app.get('/api/connectors/github/status', async (req, res, next) => {
    try {
      await githubStatusRoute(store, req, res)
    } catch (e) {
      next(e)
    }
  })

  // Central error handler (must be after all routes)
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isApiError(err)) {
      logger.warn({ error: err.message, requestId: (req as any).id })
      return res.status(err.status).json(err.toProblem())
    }

    logger.error({ error: err, requestId: (req as any).id })
    res.status(500).json(problems.internal().toProblem())
  })

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      type: 'not_found',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${req.path} not found`,
    })
  })

  return app
}
