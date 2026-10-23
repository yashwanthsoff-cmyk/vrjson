import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { problems } from '../problem.js'

export async function evidenceRoute(store: DataStore, req: Request, res: Response) {
  const { id } = req.params

  if (!id) {
    throw problems.badRequest('Evidence ID is required')
  }

  const evidence = await store.getEvidenceById(id)

  if (!evidence) {
    throw problems.notFound('Evidence not found')
  }

  res.json(evidence)
}
