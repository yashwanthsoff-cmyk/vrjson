import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { createManualFinding, getManualFindings } from '../services/findingsService.js'

const bodySchema = z.object({
  userId: z.string().min(1),
  entitlementId: z.string().min(1),
  grantId: z.string().nullable().optional(),
  actorId: z.string().min(1),
})

export async function manualFindingsRoute(store: DataStore, req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const { userId, entitlementId, grantId, actorId } = parsed.data

  const result = await createManualFinding(store, userId, entitlementId, grantId || null, actorId)
  res.json(result)
}

export async function getManualFindingsRoute(store: DataStore, req: Request, res: Response) {
  const result = await getManualFindings(store)
  res.json(result)
}
