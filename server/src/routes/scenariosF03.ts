import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import { evaluateF03Scenarios } from '../services/scenarioF03Service.js'

export async function scenarioChecksF03Route(store: DataStore, req: Request, res: Response) {
  const result = await evaluateF03Scenarios(store)
  res.json(result)
}
