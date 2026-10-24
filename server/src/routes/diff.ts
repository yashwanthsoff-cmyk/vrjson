import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { getDiff } from '../services/accessService.js'

const querySchema = z.object({
  userId: z.string().min(1),
  a: z.string().min(1),
  b: z.string().min(1),
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
})

export async function diffRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId, a, b, app } = parsed.data

  const result = await getDiff(store, userId, a, b, app)
  res.json(result)
}
