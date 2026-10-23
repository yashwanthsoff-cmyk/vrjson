import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

const querySchema = z.object({
  userId: z.string().optional(),
})

export async function roleChangesRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId } = parsed.data

  const roleChanges = await store.listRoleChanges(userId)

  res.json(roleChanges)
}
