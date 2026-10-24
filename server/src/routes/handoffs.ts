import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { handoffs as frontendHandoffs } from '../../../src/data.js'

export async function handoffsRoute(store: DataStore, req: Request, res: Response) {
  // For now, return static handoffs data from frontend
  // TODO: In Phase 4, this should be computed from decisions
  res.json(frontendHandoffs)
}
