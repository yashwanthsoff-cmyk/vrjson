import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { getInventory } from '../services/inventoryService.js'

const querySchema = z.object({
  userId: z.string().optional(),
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
})

export async function inventoryRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId, app, q, limit, offset } = parsed.data

  if (limit > 500) {
    throw problems.badRequest('Limit cannot exceed 500')
  }

  const result = await getInventory(store, { userId, app, q }, limit, offset)

  res.setHeader('X-Total-Count', result.total.toString())
  res.json(result)
}
