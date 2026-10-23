import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { getSnapshotCoverage } from '../services/coverageService.js'

export async function coverageRoute(store: DataStore, req: Request, res: Response) {
  const result = await getSnapshotCoverage(store)
  res.json(result)
}
