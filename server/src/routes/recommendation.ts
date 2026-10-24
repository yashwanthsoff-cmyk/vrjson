import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import { computeAllUsageRows } from '../services/usageEngineService.js'
import { problems } from '../problem.js'

export async function getRecommendationRoute(store: DataStore, req: Request, res: Response) {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId
  const entitlementId = Array.isArray(req.params.entitlementId)
    ? req.params.entitlementId[0]
    : req.params.entitlementId

  const sessionId = (req as any).sessionId || 'default'
  const rows = await computeAllUsageRows(store, sessionId)

  const found = rows.find((r) => r.userId === userId && r.entitlementId === entitlementId)
  if (!found) {
    throw problems.notFound(`Recommendation for user ${userId} and entitlement ${entitlementId} not found`)
  }

  // Fetch full evidence objects for the evidenceIds
  const evidenceList = []
  for (const evId of found.evidenceIds) {
    const ev = await store.getEvidenceById(evId)
    if (ev) {
      evidenceList.push(ev)
    }
  }

  res.json({
    ...found.recommendation,
    userId: found.userId,
    entitlementId: found.entitlementId,
    evidenceIds: found.evidenceIds,
    evidence: evidenceList,
    guardText: found.guardText,
  })
}
