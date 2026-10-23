import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { getBeforeAfter } from '../services/accessService.js'

const querySchema = z.object({
  userId: z.string().min(1),
  eventDate: z.string().datetime().optional(),
})

export async function beforeAfterRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId, eventDate } = parsed.data

  const result = await getBeforeAfter(store, userId, eventDate)
  res.json(result)
}
