import type { App, Entitlement, Grant, Settings, User } from '@contract'
import { DEMO_NOW } from '../clock.js'

export const DEFAULT_APP_COVERAGE: Record<App, number> = {
  google_workspace: 180,
  microsoft_entra: 30,
  github: 90,
}

/**
 * Returns effective coverage days for an app, accounting for dev flag simulateShortLogs.
 */
export function getAppCoverageDays(
  app: App,
  simulateShortLogs = false,
  overrideDays?: number
): number {
  if (simulateShortLogs) return 11
  if (overrideDays !== undefined) return overrideDays
  return DEFAULT_APP_COVERAGE[app] ?? 90
}

/**
 * Computes coverage start ISO string for an app.
 */
export function getCoverageStart(
  coverageDays: number,
  now: string = DEMO_NOW
): string {
  const nowDate = Date.parse(now)
  const startDate = new Date(nowDate - coverageDays * 86_400_000)
  return startDate.toISOString()
}

/**
 * Whole days (floor, clamped at 0) from max(coverageStart, user.startDate) to DEMO_NOW.
 */
export function computeObservedDaysUserApp(
  userStartDate: string,
  coverageStart: string,
  now: string = DEMO_NOW
): number {
  const start = Math.max(Date.parse(coverageStart), Date.parse(userStartDate))
  return Math.max(0, Math.floor((Date.parse(now) - start) / 86_400_000))
}

/**
 * Whole days from max(coverageStart, user.startDate, grant.grantedAt) to DEMO_NOW.
 */
export function computeObservedDaysUserEntitlement(
  userStartDate: string,
  coverageStart: string,
  grantedAt?: string | null,
  now: string = DEMO_NOW
): number {
  let start = Math.max(Date.parse(coverageStart), Date.parse(userStartDate))
  if (grantedAt) {
    start = Math.max(start, Date.parse(grantedAt))
  }
  return Math.max(0, Math.floor((Date.parse(now) - start) / 86_400_000))
}

/**
 * Effective windowDays = unusedWindowDays.admin if privilegeLevel is admin, else standard.
 */
export function getEffectiveWindowDays(
  privilegeLevel: Entitlement['privilegeLevel'],
  settings: Settings
): number {
  return privilegeLevel === 'admin'
    ? settings.unusedWindowDays.admin
    : settings.unusedWindowDays.standard
}
