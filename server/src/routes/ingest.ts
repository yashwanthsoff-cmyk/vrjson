import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'

export async function listIngestRunsRoute(store: DataStore, req: Request, res: Response) {
  const app = req.query.app as App | undefined
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

  const runs = await store.listIngestRuns(app)
  const sliced = runs.slice(0, limit)

  res.json({ runs: sliced, total: runs.length })
}
