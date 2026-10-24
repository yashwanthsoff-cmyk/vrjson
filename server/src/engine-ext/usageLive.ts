import type { App, UsageResult, UsageState } from '@contract'
import { DEMO_NOW } from '../clock.js'
import { getGuardText, getCoverageText } from './guardText.js'
import { logger } from '../logger.js'

export interface ClassifyUsageInput {
  observedDays: number
  windowDays: number
  lastUsedAt: string | null
  dormantAccount: boolean
  evidenceIds?: string[]
  now?: string
}

/**
 * Classifies usage state deterministically.
 * INVARIANT: never emit 'unused' when observedDays < windowDays.
 */
export function classifyUsageDeterministic(input: ClassifyUsageInput): UsageResult {
  const { observedDays, windowDays, lastUsedAt, dormantAccount, evidenceIds = [], now = DEMO_NOW } = input
  const nowDate = Date.parse(now)
  const windowMillis = windowDays * 86_400_000

  let state: UsageState

  if (lastUsedAt && Date.parse(lastUsedAt) >= nowDate - windowMillis) {
    state = 'used'
  } else if (observedDays >= windowDays) {
    state = 'unused'
  } else {
    state = 'unknown'
  }

  // Runtime Invariant Assertion
  if (state === 'unused' && observedDays < windowDays) {
    const errorMsg = `INVARIANT VIOLATION: Emitted 'unused' when observedDays (${observedDays}) < windowDays (${windowDays})`
    if (process.env.NODE_ENV === 'test') {
      throw new Error(errorMsg)
    } else {
      logger.error({ error: errorMsg, observedDays, windowDays })
      state = 'unknown'
    }
  }

  const decisionPath: string[] =
    state === 'unknown'
      ? [getGuardText('unknown', observedDays, windowDays)]
      : state === 'unused'
      ? [`No mapped events in the ${windowDays}-day window.`, getCoverageText(observedDays, windowDays)]
      : ['A mapped event falls inside the active observation window.']

  return {
    state,
    lastUsedAt,
    observedDays,
    windowDays,
    evidenceIds,
    dormantAccount,
    decisionPath,
  }
}

/**
 * Checks if an account is dormant in an app:
 * No event at all in that app within windowDays AND observedDays(user, app) >= windowDays.
 */
export function isDormantAccount(
  hasAppEventInWindow: boolean,
  observedDaysApp: number,
  windowDays: number
): boolean {
  return !hasAppEventInWindow && observedDaysApp >= windowDays
}
