import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

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
