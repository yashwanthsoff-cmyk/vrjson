import type { App } from '@contract'
import type { ActivityEvent } from '../types/extra.f03.js'
import { DEMO_NOW } from '../clock.js'

export interface BlastRadius {
  actionsLast90d: number
  ownedSharedResources: number
}

/**
 * Computes blast radius for a user in an app.
 * Returns null if coverageDays < effective blastRadiusMinCoverageDays.
 */
export function computeBlastRadius(
  app: App,
  userEvents: ActivityEvent[],
  coverageDays: number,
  minCoverageDays = 90,
  now = DEMO_NOW
): BlastRadius | null {
  if (coverageDays < minCoverageDays) {
    return null
  }

  const nowDate = Date.parse(now)
  const window90d = 90 * 86_400_000
  const recentEvents = userEvents.filter((ev) => {
    if (ev.app !== app) return false
    const evDate = Date.parse(ev.at)
    return evDate >= nowDate - window90d && evDate <= nowDate
  })

  const actionsLast90d = recentEvents.length

  const writeOrAdminResources = new Set<string>()
  for (const ev of recentEvents) {
    if (ev.actionClass === 'write' || ev.actionClass === 'admin') {
      writeOrAdminResources.add(ev.resource)
    }
  }

  return {
    actionsLast90d,
    ownedSharedResources: writeOrAdminResources.size,
  }
}
