import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import { computeLiveMapping } from '../engine-ext/mappingLive.js'
import { getSessionOverlay, applyRulesOverlay } from '../engine-ext/overlay.js'
import { computeAllUsageRows } from '../services/usageEngineService.js'

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return ''
  let str = String(val)
  // Formula injection prevention (prepends apostrophe if starts with =, +, -, @)
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function exportActivityCsvRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const seedRules = await store.listMappingRules()
  const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)
  const activitiesPage = await store.listActivityEvents()
  const activities = activitiesPage.items

  const headers = [
    'Event ID',
    'App',
    'User ID',
    'Action',
    'Timestamp',
    'Target Resource',
    'Mapped Entitlement ID',
    'Is Simulated',
  ]

  const lines = [headers.join(',')]

  for (const act of activities) {
    const live = computeLiveMapping(act, effectiveRules)
    lines.push(
      [
        escapeCsv(act.id),
        escapeCsv(act.app),
        escapeCsv(act.userId),
        escapeCsv(act.at),
        escapeCsv(act.action),
        escapeCsv(act.resource || ''),
        escapeCsv(live.mappedEntitlementId || ''),
        escapeCsv(act.isSimulated ? 'true' : 'false'),
      ].join(',')
    )
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="activity.csv"')
  res.send(lines.join('\n'))
}

export async function exportUsageCsvRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const rows = await computeAllUsageRows(store, sessionId)

  const headers = [
    'User ID',
    'Display Name',
    'App',
    'Entitlement ID',
    'Entitlement Name',
    'Usage State',
    'Observed Days',
    'Window Days',
    'Recommendation',
    'Risk Score',
    'Dormant Account',
  ]

  const lines = [headers.join(',')]

  for (const r of rows) {
    lines.push(
      [
        escapeCsv(r.userId),
        escapeCsv(r.displayName),
        escapeCsv(r.app),
        escapeCsv(r.entitlementId),
        escapeCsv(r.entitlementName),
        escapeCsv(r.usage.state),
        escapeCsv(r.coverage.observedDays),
        escapeCsv(r.coverage.windowDays),
        escapeCsv(r.recommendation.action),
        escapeCsv(r.riskScore),
        escapeCsv(r.usage.dormantAccount ? 'true' : 'false'),
      ].join(',')
    )
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="usage.csv"')
  res.send(lines.join('\n'))
}

export async function exportInventoryCsvRoute(store: DataStore, req: Request, res: Response) {
  const usersPage = await store.listUsers()
  const entitlementsPage = await store.listEntitlements()
  const grantsPage = await store.listGrants()

  const userMap = new Map(usersPage.items.map((u) => [u.id, u]))
  const entMap = new Map(entitlementsPage.items.map((e) => [e.id, e]))

  const headers = [
    'Grant ID',
    'User ID',
    'User Name',
    'Department',
    'App',
    'Entitlement ID',
    'Entitlement Name',
    'Privilege Level',
    'Data Sensitivity',
    'Granted At',
  ]

  const lines = [headers.join(',')]

  for (const g of grantsPage.items) {
    const u = userMap.get(g.userId)
    const e = entMap.get(g.entitlementId)
    lines.push(
      [
        escapeCsv(g.id),
        escapeCsv(g.userId),
        escapeCsv(u?.displayName || ''),
        escapeCsv(u?.department || ''),
        escapeCsv(g.app),
        escapeCsv(g.entitlementId),
        escapeCsv(e?.name || ''),
        escapeCsv(e?.privilegeLevel || ''),
        escapeCsv(e?.dataSensitivity || ''),
        escapeCsv(g.grantedAt),
      ].join(',')
    )
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"')
  res.send(lines.join('\n'))
}
