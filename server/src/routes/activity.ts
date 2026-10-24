import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import type { ActivityRow } from '../types/extra.f03.js'
import { computeLiveMapping } from '../engine-ext/mappingLive.js'
import { getSessionOverlay, applyRulesOverlay } from '../engine-ext/overlay.js'
import { problems } from '../problem.js'

const querySchema = z.object({
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
  userId: z.string().optional(),
  mapped: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().min(1).max(500).default(50),
  cursor: z.string().optional(),
})

export async function activityRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { app, userId, mapped, limit, cursor } = parsed.data
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const seedRules = await store.listMappingRules()
  const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)

  // Fetch users & entitlements for display names
  const usersPage = await store.listUsers()
  const userMap = new Map(usersPage.items.map((u) => [u.id, u]))
  const entitlementsPage = await store.listEntitlements()
  const entMap = new Map(entitlementsPage.items.map((e) => [e.id, e]))

  // Fetch activities from store
  const allEventsPage = await store.listActivityEvents({ app: app as App, userId })
  const allEvents = allEventsPage.items

  // Recompute live mapping for every event (Section 3 Rule 5: LIVE MAPPING WINS)
  const mappedEvents: ActivityRow[] = allEvents.map((evt) => {
    const live = computeLiveMapping(evt, effectiveRules)
    const user = userMap.get(evt.userId)
    const ent = live.mappedEntitlementId ? entMap.get(live.mappedEntitlementId) : null

    return {
      id: evt.id,
      app: evt.app as App,
      userId: evt.userId,
      at: evt.at,
      action: evt.action,
      resource: evt.resource,
      actionClass: evt.actionClass,
      displayName: user?.displayName || evt.userId,
      pseudonym: user?.pseudonym || evt.userId,
      mappedEntitlementId: live.mappedEntitlementId,
      mappedEntitlementName: ent ? ent.name : null,
      matchedRuleId: live.matchedRuleId,
      isSimulated: evt.isSimulated ?? false,
    }
  })

  // Filter by mapped status if specified
  let filtered = mappedEvents
  if (mapped === 'true') {
    filtered = filtered.filter((e) => e.mappedEntitlementId !== null)
  } else if (mapped === 'false') {
    filtered = filtered.filter((e) => e.mappedEntitlementId === null)
  }

  // Handle cursor pagination
  let startIndex = 0
  if (cursor) {
    const idx = filtered.findIndex((e) => e.id === cursor)
    if (idx >= 0) {
      startIndex = idx + 1
    }
  }

  const paginated = filtered.slice(startIndex, startIndex + limit)
  const nextCursor =
    paginated.length === limit && startIndex + limit < filtered.length
      ? paginated[paginated.length - 1].id
      : undefined

  res.setHeader('X-Total-Count', filtered.length.toString())
  res.json({
    items: paginated,
    total: filtered.length,
    cursor: nextCursor,
  })
}

export async function activitySummaryRoute(store: DataStore, req: Request, res: Response) {
  const app = req.query.app as App | undefined
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const seedRules = await store.listMappingRules()
  const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)

  const allEventsPage = await store.listActivityEvents({ app })
  const allEvents = allEventsPage.items

  let totalEvents = 0
  let mappedCount = 0
  let unmappedCount = 0
  const unmappedActionCounts = new Map<string, number>()

  for (const evt of allEvents) {
    totalEvents++
    const live = computeLiveMapping(evt, effectiveRules)
    if (live.mappedEntitlementId !== null) {
      mappedCount++
    } else {
      unmappedCount++
      const current = unmappedActionCounts.get(evt.action) || 0
      unmappedActionCounts.set(evt.action, current + 1)
    }
  }

  const topUnmappedEvents = Array.from(unmappedActionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  res.json({
    totalEvents,
    mappedEvents: mappedCount,
    unmappedEvents: unmappedCount,
    topUnmappedEvents,
  })
}
