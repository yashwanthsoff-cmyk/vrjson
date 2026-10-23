import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import type { ObservationRowView } from '../types/extra.f03.js'
import {
  getAppCoverageDays,
  getCoverageStart,
  computeObservedDaysUserEntitlement,
  getEffectiveWindowDays,
} from '../engine-ext/observationLive.js'
import { getSessionOverlay, applySettingsOverlay } from '../engine-ext/overlay.js'
import { BASE_SETTINGS } from '../services/usageEngineService.js'
import { DEMO_NOW } from '../clock.js'

export async function observationWindowsRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)
  const settings = applySettingsOverlay(BASE_SETTINGS, overlay.settings)

  const simulateShortLogs = ((await store.getDevFlag('simulateShortLogs')) as boolean) ?? false

  const usersPage = await store.listUsers()
  const userMap = new Map(usersPage.items.map((u) => [u.id, u]))
  const entitlementsPage = await store.listEntitlements()
  const entMap = new Map(entitlementsPage.items.map((e) => [e.id, e]))
  const grantsPage = await store.listGrants()

  const rows: ObservationRowView[] = []

  for (const grant of grantsPage.items) {
    const user = userMap.get(grant.userId)
    const ent = entMap.get(grant.entitlementId)
    if (!user || !ent) continue

    const app = ent.app as App
    const coverageDays = getAppCoverageDays(app, simulateShortLogs)
    const coverageStart = getCoverageStart(coverageDays, DEMO_NOW)
    const observedDays = computeObservedDaysUserEntitlement(
      user.startDate,
      coverageStart,
      grant.grantedAt,
      DEMO_NOW
    )

    const windowAdminDays = settings.unusedWindowDays.admin
    const windowStandardDays = settings.unusedWindowDays.standard

    rows.push({
      userId: user.id,
      displayName: user.displayName,
      pseudonym: user.pseudonym,
      app,
      coverageStart,
      observedDays,
      coverageDays,
      windowAdminDays,
      windowStandardDays,
      sufficientAdmin: observedDays >= windowAdminDays,
      sufficientStandard: observedDays >= windowStandardDays,
    })
  }

  res.json({ windows: rows, total: rows.length })
}
