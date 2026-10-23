import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { getAccessAsOf } from '../services/accessService.js'

const querySchema = z.object({
  userId: z.string().min(1),
  date: z.string().datetime(),
})

export async function accessAsOfRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId, date } = parsed.data

  // Reject future dates
  const requestedDate = new Date(date)
  const now = new Date()
  if (requestedDate > now) {
    throw problems.badRequest('Future dates are not allowed')
  }

  const result = await getAccessAsOf(store, userId, date)
  res.json(result)
}
