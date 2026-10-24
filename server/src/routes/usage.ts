import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DataStore } from '../store/DataStore.js'
import type { App, UsageState } from '@contract'
import { computeAllUsageRows, BASE_SETTINGS } from '../services/usageEngineService.js'
import { classifyUsageDeterministic, isDormantAccount } from '../engine-ext/usageLive.js'
import { computeRecommendationCard } from '../engine-ext/recommendLive.js'
import { computeBlastRadius } from '../engine-ext/blastRadius.js'
import { computeRiskScore } from '../engine-ext/scoreLive.js'
import { getCoverageText, getGuardText } from '../engine-ext/guardText.js'
import {
  getAppCoverageDays,
  getCoverageStart,
  computeObservedDaysUserEntitlement,
  getEffectiveWindowDays,
} from '../engine-ext/observationLive.js'
import { DEMO_NOW } from '../clock.js'
import { problems } from '../problem.js'

const querySchema = z.object({
  userId: z.string().optional(),
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
  state: z.enum(['active', 'infrequent', 'stale', 'unused', 'unknown', 'never_used']).optional(),
  dormant: z.enum(['true', 'false']).optional(),
  seasonal: z.enum(['true', 'false']).optional(),
  minRisk: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(500).default(50),
  cursor: z.string().optional(),
})

export async function listUsageRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const sessionId = (req as any).sessionId || 'default'
  const rows = await computeAllUsageRows(store, sessionId)

  const { userId, app, state, dormant, seasonal, minRisk, limit, cursor } = parsed.data

  let filtered = rows

  if (userId) {
    filtered = filtered.filter((r) => r.userId === userId)
  }
  if (app) {
    filtered = filtered.filter((r) => r.app === app)
  }
  if (state) {
    filtered = filtered.filter((r) => r.usage.state === state)
  }
  if (dormant !== undefined) {
    const isDormant = dormant === 'true'
    filtered = filtered.filter((r) => r.usage.dormantAccount === isDormant)
  }
  if (seasonal !== undefined) {
    const isSeasonal = seasonal === 'true'
    filtered = filtered.filter((r) => Boolean(r.seasonal) === isSeasonal)
  }
  if (minRisk !== undefined) {
    filtered = filtered.filter((r) => r.riskScore >= minRisk)
  }

  let startIndex = 0
  if (cursor) {
    const idx = filtered.findIndex((r) => `${r.userId}:${r.entitlementId}` === cursor)
    if (idx >= 0) {
      startIndex = idx + 1
    }
  }

  const paginated = filtered.slice(startIndex, startIndex + limit)
  const nextCursor =
    paginated.length === limit && startIndex + limit < filtered.length
      ? `${paginated[paginated.length - 1].userId}:${paginated[paginated.length - 1].entitlementId}`
      : undefined

  res.setHeader('X-Total-Count', filtered.length.toString())
  res.json({
    items: paginated,
    total: filtered.length,
    cursor: nextCursor,
  })
}

export async function getUsageItemRoute(store: DataStore, req: Request, res: Response) {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId
  const entitlementId = Array.isArray(req.params.entitlementId)
    ? req.params.entitlementId[0]
    : req.params.entitlementId

  const sessionId = (req as any).sessionId || 'default'
  const rows = await computeAllUsageRows(store, sessionId)

  const found = rows.find((r) => r.userId === userId && r.entitlementId === entitlementId)
  if (!found) {
    throw problems.notFound(`Usage record for user ${userId} and entitlement ${entitlementId} not found`)
  }

  res.json(found)
}

export async function listUsageFindingsRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const rows = await computeAllUsageRows(store, sessionId)

  // Generate findings from rows that warrant findings (unused, stale, infrequent)
  const findings = rows
    .filter((r) => ['unused', 'stale', 'infrequent'].includes(r.usage.state))
    .map((r) => ({
      id: r.findingId || `find-usage-${r.userId}-${r.entitlementId}`,
      userId: r.userId,
      entitlementId: r.entitlementId,
      app: r.app,
      type: 'unused' as const,
      riskScore: r.riskScore,
      recommendation: r.recommendation.action,
      confidence: r.recommendation.confidence,
      blastRadius: r.recommendation.blastRadius,
      usage: r.usage,
      status: 'open' as const,
      ownerId: 'sec-admin',
      dueDate: new Date(Date.parse(DEMO_NOW) + 14 * 86_400_000).toISOString(),
      evidenceIds: r.evidenceIds,
      version: 1,
    }))

  res.json({ findings, total: findings.length })
}

const evaluateSchema = z.object({
  user: z
    .object({
      id: z.string().default('eval-user'),
      startDate: z.string().default('2024-01-01T00:00:00Z'),
      role: z.string().default('Engineer'),
    })
    .optional(),
  entitlement: z
    .object({
      id: z.string().default('eval-ent'),
      app: z.enum(['google_workspace', 'microsoft_entra', 'github']).default('google_workspace'),
      name: z.string().default('Eval Entitlement'),
      privilegeLevel: z.enum(['admin', 'standard', 'read']).default('standard'),
      dataSensitivity: z.enum(['none', 'internal', 'confidential', 'pii_financial']).default('none'),
      categories: z.array(z.string()).default([]),
      seasonal: z.boolean().optional(),
    })
    .optional(),
  activityTimestamps: z.array(z.string()).optional(),
  allAppActivityTimestamps: z.array(z.string()).optional(),
  grantedAt: z.string().optional(),
})

export async function evaluateUsageRoute(store: DataStore, req: Request, res: Response) {
  const parsed = evaluateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid evaluation payload')
  }

  const baseSettings = BASE_SETTINGS
  const user = parsed.data.user || {
    id: 'eval-user',
    startDate: '2024-01-01T00:00:00Z',
    role: 'Engineer',
  }
  const ent = parsed.data.entitlement || {
    id: 'eval-ent',
    app: 'google_workspace' as App,
    name: 'Eval Entitlement',
    privilegeLevel: 'standard' as const,
    dataSensitivity: 'none' as const,
    categories: [],
    seasonal: false,
  }

  const app = ent.app as App
  const covDays = getAppCoverageDays(app)
  const covStart = getCoverageStart(covDays, DEMO_NOW)
  const observedDays = computeObservedDaysUserEntitlement(
    user.startDate,
    covStart,
    parsed.data.grantedAt,
    DEMO_NOW
  )
  const privLevel = ent.privilegeLevel === 'admin' ? 'admin' : 'read'
  const windowDays = getEffectiveWindowDays(privLevel, baseSettings)

  const timestamps = (parsed.data.activityTimestamps || []).sort()
  const lastUsedAt = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null

  const allAppTimestamps = parsed.data.allAppActivityTimestamps || timestamps
  const hasAppEventInWindow = allAppTimestamps.some(
    (t) => Date.parse(DEMO_NOW) - Date.parse(t) <= windowDays * 86_400_000
  )
  const dormantAccount = isDormantAccount(hasAppEventInWindow, observedDays, windowDays)

  const usage = classifyUsageDeterministic({
    lastUsedAt,
    observedDays,
    windowDays,
    dormantAccount,
    now: DEMO_NOW,
  })

  const mockEvents = timestamps.map((ts, idx) => ({
    id: `eval-evt-${idx}`,
    userId: user.id,
    app,
    at: ts,
    action: 'mock_action',
    resource: 'res',
    actionClass: 'read' as const,
  }))

  const blastRadius = computeBlastRadius(app, mockEvents, covDays, 90, DEMO_NOW)
  const recommendation = computeRecommendationCard({
    usage,
    blastRadius,
    confidence: 'high',
    confidenceReason: 'Simulated evaluation',
    dormantAccount,
    hasDowngrade: false,
    isSeasonal: Boolean(ent.seasonal),
    coverageDays: covDays,
  })

  const guardText = getGuardText(usage.state, observedDays, windowDays)
  const coverage = {
    coveredDays: Math.min(observedDays, windowDays),
    windowDays,
    observedDays,
    coverageDays: covDays,
    text: getCoverageText(observedDays, windowDays),
  }

  const daysSinceLastUse = lastUsedAt
    ? Math.floor((Date.parse(DEMO_NOW) - Date.parse(lastUsedAt)) / 86_400_000)
    : null
  const observedCoveragePct = Math.min(1.0, observedDays / windowDays)
  const { riskScore, scoreBreakdown } = computeRiskScore(
    ent as any,
    observedCoveragePct,
    daysSinceLastUse,
    baseSettings
  )

  res.json({
    usage,
    recommendation,
    guardText,
    coverage,
    riskScore,
    scoreBreakdown,
  })
}
