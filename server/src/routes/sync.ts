import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { simulateSync, updateSchedule } from '../services/syncService.js'

const querySchema = z.object({
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
})

export async function syncRunsRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { app } = parsed.data

  const result = await store.listSyncRuns(app)
  res.json(result)
}

export async function scheduleRoute(store: DataStore, req: Request, res: Response) {
  const result = await Promise.all([
    store.getSyncSchedule('google_workspace'),
    store.getSyncSchedule('microsoft_entra'),
    store.getSyncSchedule('github'),
  ])

  res.json(result.filter((s) => s !== null))
}

const simulateBodySchema = z.object({
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']),
  withChange: z.boolean().default(false),
  actorId: z.string().min(1),
})

export async function syncSimulateRoute(store: DataStore, req: Request, res: Response) {
  const parsed = simulateBodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const { app, withChange, actorId } = parsed.data

  const result = await simulateSync(store, app, withChange, actorId)
  res.json(result)
}

const scheduleBodySchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'manual']),
  enabled: z.boolean(),
  actorId: z.string().min(1),
})

export async function scheduleUpdateRoute(store: DataStore, req: Request, res: Response) {
  const { app } = req.params
  const parsed = scheduleBodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const { frequency, enabled, actorId } = parsed.data

  const result = await updateSchedule(store, app as any, frequency, enabled, actorId)
  res.json(result)
}
