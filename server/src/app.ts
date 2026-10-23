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
