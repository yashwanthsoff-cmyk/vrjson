import type { Request, Response } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import type { EventMappingRule, MappingRuleView, MappingTestResult } from '../types/extra.f03.js'
import { findMatchingRule, countLiteralCharacters } from '../engine-ext/glob.js'
import { getSessionOverlay, applyRulesOverlay } from '../engine-ext/overlay.js'
import { problems } from '../problem.js'

export async function listMappingRulesRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const seedRules = await store.listMappingRules()
  const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)
  const activitiesPage = await store.listActivityEvents()
  const activities = activitiesPage.items

  // Calculate matchCount for each rule against current activity
  const views: MappingRuleView[] = effectiveRules.map((rule) => {
    const specificity = countLiteralCharacters(rule.actionPattern)
    let matchCount = 0

    for (const act of activities) {
      if (act.app === rule.app) {
        const winning = findMatchingRule(rule.app as App, act.action, effectiveRules)
        if (winning?.id === rule.id) {
          matchCount++
        }
      }
    }

    return {
      ...rule,
      specificity,
      matchCount,
    }
  })

  res.json({ rules: views, total: views.length })
}

const testSchema = z.object({
  action: z.string().min(1),
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']),
})

export async function testMappingRoute(store: DataStore, req: Request, res: Response) {
  const parsed = testSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid test mapping parameters')
  }

  const { action, app } = parsed.data
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const seedRules = await store.listMappingRules()
  const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)

  const matchedRule = findMatchingRule(app as App, action, effectiveRules)

  let matchedView: MappingRuleView | null = null
  let entitlementName: string | null = null

  if (matchedRule) {
    matchedView = {
      ...matchedRule,
      source: overlay.rules.added.some((r) => r.id === matchedRule.id) ? 'session' : 'seed',
      edited: Boolean(overlay.rules.edited[matchedRule.id]),
      specificity: countLiteralCharacters(matchedRule.actionPattern),
    }

    const ent = await store.getEntitlementById(matchedRule.entitlementId)
    entitlementName = ent ? ent.name : null
  }

  const result: MappingTestResult = {
    app: app as App,
    action,
    matchedRule: matchedView,
    entitlementId: matchedRule ? matchedRule.entitlementId : null,
    entitlementName,
    message: matchedRule
      ? `Action matched rule ${matchedRule.id} -> ${matchedRule.entitlementId}`
      : 'No mapping rule matched this action',
  }

  res.json(result)
}

const createRuleSchema = z.object({
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']),
  actionPattern: z.string().min(1),
  entitlementId: z.string().min(1),
  note: z.string().default(''),
})

export async function createMappingRuleRoute(store: DataStore, req: Request, res: Response) {
  const parsed = createRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid mapping rule payload')
  }

  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const newRule: EventMappingRule = {
    id: `rule-sess-${randomUUID().slice(0, 8)}`,
    app: parsed.data.app,
    actionPattern: parsed.data.actionPattern,
    entitlementId: parsed.data.entitlementId,
    note: parsed.data.note,
  }

  overlay.rules.added.push(newRule)

  const view: MappingRuleView = {
    ...newRule,
    source: 'session',
    edited: false,
    specificity: countLiteralCharacters(newRule.actionPattern),
    matchCount: 0,
  }

  res.status(201).json(view)
}

const updateRuleSchema = z.object({
  actionPattern: z.string().min(1).optional(),
  entitlementId: z.string().min(1).optional(),
  note: z.string().optional(),
})

export async function updateMappingRuleRoute(store: DataStore, req: Request, res: Response) {
  const ruleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const parsed = updateRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid mapping rule update')
  }

  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  // Check if it was an added rule in session
  const addedIndex = overlay.rules.added.findIndex((r) => r.id === ruleId)
  if (addedIndex >= 0) {
    overlay.rules.added[addedIndex] = {
      ...overlay.rules.added[addedIndex],
      ...parsed.data,
    }
    const updated = overlay.rules.added[addedIndex]
    return res.json({
      ...updated,
      source: 'session',
      edited: true,
      specificity: countLiteralCharacters(updated.actionPattern),
    })
  }

  // Check if rule exists in seed
  const seedRules = await store.listMappingRules()
  const existingSeed = seedRules.find((r) => r.id === ruleId)
  if (!existingSeed) {
    throw problems.notFound(`Mapping rule ${ruleId} not found`)
  }

  overlay.rules.edited[ruleId] = {
    ...(overlay.rules.edited[ruleId] || {}),
    ...parsed.data,
  }

  const updated: MappingRuleView = {
    ...existingSeed,
    ...overlay.rules.edited[ruleId],
    source: 'session',
    edited: true,
    specificity: countLiteralCharacters(
      overlay.rules.edited[ruleId].actionPattern || existingSeed.actionPattern
    ),
  }

  res.json(updated)
}

export async function deleteMappingRuleRoute(store: DataStore, req: Request, res: Response) {
  const ruleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  // If in added rules, remove from added
  const addedIndex = overlay.rules.added.findIndex((r) => r.id === ruleId)
  if (addedIndex >= 0) {
    overlay.rules.added.splice(addedIndex, 1)
    return res.json({ success: true, deletedRuleId: ruleId })
  }

  // Otherwise tombstone
  if (!overlay.rules.tombstoned.includes(ruleId)) {
    overlay.rules.tombstoned.push(ruleId)
  }

  res.json({ success: true, deletedRuleId: ruleId })
}
