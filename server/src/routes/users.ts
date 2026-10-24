import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

const querySchema = z.object({
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
})

export async function usersRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { limit, offset } = parsed.data

  const result = await store.listUsers(limit, offset)

  res.setHeader('X-Total-Count', result.total.toString())
  res.json(result)
}

export async function userByIdRoute(store: DataStore, req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const user = await store.getUserById(id)

  if (!user) {
    throw problems.notFound('User not found')
  }

  res.json(user)
}
