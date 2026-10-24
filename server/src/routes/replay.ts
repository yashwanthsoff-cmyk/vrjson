import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { performReplayCheck } from '../services/replayService.js'

const bodySchema = z.object({
  snapshotId: z.string().optional(),
})

export async function replayCheckRoute(store: DataStore, req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const { snapshotId } = parsed.data

  const result = await performReplayCheck(store, snapshotId)
  res.json(result)
}
