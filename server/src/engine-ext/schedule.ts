import type { SyncSchedule } from '../types/extra.js'
import { DEMO_NOW, addDays } from '../clock.js'

/**
 * Rule 9: Schedule next run.
 * lastRunAt (or DEMO_NOW if null) + 1 day (daily) or + 7 days (weekly).
 * null if manual or disabled.
 */
export function computeNextRun(schedule: SyncSchedule): string | null {
  if (!schedule.enabled || schedule.frequency === 'manual') {
    return null
  }

  const base = schedule.lastRunAt || DEMO_NOW

  if (schedule.frequency === 'daily') {
    return addDays(base, 1)
  }

  if (schedule.frequency === 'weekly') {
    return addDays(base, 7)
  }

  return null
}
