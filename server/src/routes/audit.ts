import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

const querySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
})

export async function auditRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { actorId, action, targetType, from, to, q, limit, offset } = parsed.data

  if (limit > 500) {
    throw problems.badRequest('Limit cannot exceed 500')
  }

  const result = await store.listAudit({ actorId, action, targetType, from, to, q }, limit, offset)

  res.setHeader('X-Total-Count', result.total.toString())
  res.json(result)
}
