import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { activity as frontendActivity } from '../../../src/data.js'

const querySchema = z.object({
  userId: z.string().optional(),
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
})

export async function activityRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId, app, limit, offset } = parsed.data

  // For now, return static activity data from frontend
  // TODO: In Phase 4, this should be computed from grant activity logs
  let items = [...frontendActivity]

  if (userId) {
    items = items.filter((a) => a.userId === userId)
  }

  if (app) {
    const appMap: Record<string, string> = {
      google_workspace: 'Google Workspace',
      microsoft_entra: 'Microsoft Entra',
      github: 'GitHub',
    }
    items = items.filter((a) => a.app === appMap[app])
  }

  const total = items.length
  const paginatedItems = items.slice(offset, offset + limit)

  res.setHeader('X-Total-Count', total.toString())
  res.json({ items: paginatedItems, total, limit, offset })
}
