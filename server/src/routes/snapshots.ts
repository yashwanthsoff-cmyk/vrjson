import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

const querySchema = z.object({
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  complete: z.string().transform((v) => v === 'true').optional(),
  limit: z.string().transform(Number).default('100'),
  offset: z.string().transform(Number).default('0'),
})

export async function snapshotsRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { app, from, to, complete, limit, offset } = parsed.data

  if (limit > 500) {
    throw problems.badRequest('Limit cannot exceed 500')
  }

  const result = await store.listSnapshots({ app, from, to, complete }, limit, offset)

  res.setHeader('X-Total-Count', result.total.toString())
  res.json(result)
}
