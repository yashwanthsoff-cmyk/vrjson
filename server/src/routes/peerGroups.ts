import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { peerGroups as frontendPeerGroups } from '../../../src/data.js'

export async function peerGroupsRoute(store: DataStore, req: Request, res: Response) {
  // For now, return static peer groups data from frontend
  // TODO: In Phase 4, this should be computed from the peer analysis engine
  res.json(frontendPeerGroups)
}
