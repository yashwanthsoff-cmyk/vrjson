import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

const querySchema = z.object({
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
})

export async function entitlementsRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { limit, offset } = parsed.data

  const result = await store.listEntitlements(limit, offset)

  res.setHeader('X-Total-Count', result.total.toString())
  res.json(result)
}

export async function entitlementByIdRoute(store: DataStore, req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const entitlement = await store.getEntitlementById(id)

  if (!entitlement) {
    throw problems.notFound('Entitlement not found')
  }

  res.json(entitlement)
}
