import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { generateDriftSummary } from '../services/driftService.js'

const bodySchema = z.object({
  userId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
  showNames: z.boolean().default(false),
})

export async function driftSummaryRoute(store: DataStore, req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const { userId, from, to, showNames } = parsed.data
  const actorId = (req as any).actorId || 'system'

  const result = await generateDriftSummary(store, userId, from, to, showNames, actorId)
  res.json(result)
}
