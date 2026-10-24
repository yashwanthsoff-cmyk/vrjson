import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import { computeAllUsageRows } from '../services/usageEngineService.js'
import { problems } from '../problem.js'

export async function getCoverageGuardRoute(store: DataStore, req: Request, res: Response) {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId
  const entitlementId = Array.isArray(req.params.entitlementId)
    ? req.params.entitlementId[0]
    : req.params.entitlementId

  const sessionId = (req as any).sessionId || 'default'
  const rows = await computeAllUsageRows(store, sessionId)

  const found = rows.find((r) => r.userId === userId && r.entitlementId === entitlementId)
  if (!found) {
    throw problems.notFound(`Coverage guard for user ${userId} and entitlement ${entitlementId} not found`)
  }

  const isShortLogs = found.coverage.coverageDays < 14
  const canRevoke = found.recommendation.action === 'revoke'

  res.json({
    guardText: found.guardText,
    observedDays: found.coverage.observedDays,
    windowDays: found.coverage.windowDays,
    coverageDays: found.coverage.coverageDays,
    isShortLogs,
    canRevoke,
  })
}
