import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { env } from './env.js'
import { logger } from './logger.js'
import { isApiError, problems } from './problem.js'
import { MemoryStore } from './store/MemoryStore.js'
import { SupabaseStore } from './store/SupabaseStore.js'
import type { DataStore } from './store/DataStore.js'

export function createApp(store: DataStore) {
  const app = express()

  // Security middleware
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json({ limit: '100kb' }))

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    res.setHeader('x-request-id', req.id)
    next()
  })

  // Actor and session middleware
  app.use(async (req, res, next) => {
    const actorId = req.headers['x-actor-id'] as string || 'rev-asha' // Default to Asha Rao
    const sessionId = req.headers['x-session-id'] as string || `sess-${Date.now()}`

    (req as any).actorId = actorId
    (req as any).sessionId = sessionId

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

  // Central error handler
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isApiError(err)) {
      logger.warn({ error: err.message, requestId: req.id })
      return res.status(err.status).json(err.toProblem())
    }

    logger.error({ error: err, requestId: req.id })
    res.status(500).json(problems.internal().toProblem())
  })

  // Health endpoint
  app.get('/health', async (req, res) => {
    const { healthRoute } = await import('./routes/health.js')
    return healthRoute(store, req, res)
  })

  app.get('/api/health', async (req, res) => {
    const { healthRoute } = await import('./routes/health.js')
    return healthRoute(store, req, res)
  })

  // Read routes
  app.get('/api/inventory', async (req, res) => {
    const { inventoryRoute } = await import('./routes/inventory.js')
    return inventoryRoute(store, req, res)
  })

  app.get('/api/grants', async (req, res) => {
    const { grantsRoute } = await import('./routes/grants.js')
    return grantsRoute(store, req, res)
  })

  app.get('/api/snapshots', async (req, res) => {
    const { snapshotsRoute } = await import('./routes/snapshots.js')
    return snapshotsRoute(store, req, res)
  })

  app.get('/api/access-as-of', async (req, res) => {
    const { accessAsOfRoute } = await import('./routes/accessAsOf.js')
    return accessAsOfRoute(store, req, res)
  })

  app.get('/api/diff', async (req, res) => {
    const { diffRoute } = await import('./routes/diff.js')
    return diffRoute(store, req, res)
  })

  app.get('/api/snapshot-coverage', async (req, res) => {
    const { coverageRoute } = await import('./routes/coverage.js')
    return coverageRoute(store, req, res)
  })

  app.get('/api/before-after', async (req, res) => {
    const { beforeAfterRoute } = await import('./routes/beforeAfter.js')
    return beforeAfterRoute(store, req, res)
  })

  app.get('/api/evidence/:id', async (req, res) => {
    const { evidenceRoute } = await import('./routes/evidence.js')
    return evidenceRoute(store, req, res)
  })

  app.get('/api/audit', async (req, res) => {
    const { auditRoute } = await import('./routes/audit.js')
    return auditRoute(store, req, res)
  })

  app.get('/api/sync-runs', async (req, res) => {
    const { syncRunsRoute } = await import('./routes/sync.js')
    return syncRunsRoute(store, req, res)
  })

  app.get('/api/schedule', async (req, res) => {
    const { scheduleRoute } = await import('./routes/sync.js')
    return scheduleRoute(store, req, res)
  })

  app.get('/api/export/diff.csv', async (req, res) => {
    const { exportDiffCsvRoute } = await import('./routes/export.js')
    return exportDiffCsvRoute(store, req, res)
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
