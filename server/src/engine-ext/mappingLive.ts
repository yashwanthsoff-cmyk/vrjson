import type { App } from '@contract'
import type { ActivityEvent, EventMappingRule } from '../types/extra.f03.js'
import { findMatchingRule } from './glob.js'

export interface LiveMappedEvent extends ActivityEvent {
  mappedEntitlementId: string | null
  matchedRuleId: string | null
}

/**
 * Recomputes live mapping for an activity event using the effective rule set.
 * LIVE MAPPING WINS - seed mapped flags are never trusted.
 */
export function computeLiveMapping<T extends EventMappingRule>(
  event: ActivityEvent,
  rules: T[]
): LiveMappedEvent {
  const matchedRule = findMatchingRule(event.app, event.action, rules)
  return {
    ...event,
    mappedEntitlementId: matchedRule ? matchedRule.entitlementId : null,
    matchedRuleId: matchedRule ? matchedRule.id : null,
  }
}

/**
 * Maps a single action and app against the rule set.
 */
export function mapAction<T extends EventMappingRule>(
  app: App,
  action: string,
  rules: T[]
): { matchedRule: T | null; entitlementId: string | null } {
  const matchedRule = findMatchingRule(app, action, rules)
  return {
    matchedRule,
    entitlementId: matchedRule ? matchedRule.entitlementId : null,
  }
}
