import type { Grant } from '@contract'
import type { PrePostComparison, RoleChange } from '../types/extra.js'
import { isActiveOnDate } from './hash.js'

/**
 * Compute before-after comparison for a user around an event date.
 * Uses role change as the default event.
 */
export function computePrePost(
  userId: string,
  eventDate: string,
  grants: Grant[],
  roleChanges: RoleChange[]
): PrePostComparison {
  const roleChange = roleChanges.find((rc) => rc.userId === userId) || null

  // If no eventDate provided, use role change date
  const effectiveDate = eventDate || roleChange?.changedAt || '2026-01-01T00:00:00Z'

  // Get grants before the event
  const before = grants.filter((g) => g.userId === userId && isActiveOnDate(g, effectiveDate))

  // Get grants after the event (use a point 1 second after)
  const afterDate = new Date(effectiveDate)
  afterDate.setSeconds(afterDate.getSeconds() + 1)
  const afterDateStr = afterDate.toISOString()

  const after = grants.filter((g) => g.userId === userId && isActiveOnDate(g, afterDateStr))

  // Find carried-over grants (in both before and after)
  const beforeIds = new Set(before.map((g) => g.id))
  const carriedOver = after.filter((g) => beforeIds.has(g.id))

  return {
    userId,
    eventDate: effectiveDate,
    before,
    after,
    carriedOver,
    carriedOverCount: carriedOver.length,
    totalCount: after.length,
  }
}
