import type { Entitlement, Settings } from '@contract'
import type { EventMappingRule, MappingRuleView } from '../types/extra.f03.js'
import { env } from '../env.js'

export interface SessionTagOverride {
  privilegeLevel?: Entitlement['privilegeLevel']
  dataSensitivity?: Entitlement['dataSensitivity']
  categories?: string[]
}

export interface SessionRulesOverlay {
  added: EventMappingRule[]
  edited: Record<string, Partial<EventMappingRule>>
  tombstoned: string[] // rule IDs
}

export interface SessionOverlayData {
  settings?: Partial<Settings>
  tags: Record<string, SessionTagOverride> // entitlementId -> override
  rules: SessionRulesOverlay
  lastAccessedAt: number
}

const MAX_SESSIONS = 500
const overlays = new Map<string, SessionOverlayData>()

function getTtlMillis(): number {
  const ttlMin = env.SESSION_OVERLAY_TTL_MIN || 120
  return ttlMin * 60 * 1000
}

/**
 * Prunes expired sessions and limits size to MAX_SESSIONS.
 */
function cleanupExpired() {
  const now = Date.now()
  const ttl = getTtlMillis()

  for (const [sessionId, data] of overlays.entries()) {
    if (now - data.lastAccessedAt > ttl) {
      overlays.delete(sessionId)
    }
  }

  if (overlays.size > MAX_SESSIONS) {
    // Sort by lastAccessedAt ascending, delete oldest
    const entries = Array.from(overlays.entries()).sort(
      (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
    )
    const toRemove = overlays.size - MAX_SESSIONS
    for (let i = 0; i < toRemove; i++) {
      overlays.delete(entries[i][0])
    }
  }
}

/**
 * Gets or creates the session overlay.
 */
export function getSessionOverlay(sessionId: string): SessionOverlayData {
  cleanupExpired()

  let data = overlays.get(sessionId)
  if (!data) {
    data = {
      tags: {},
      rules: { added: [], edited: {}, tombstoned: [] },
      lastAccessedAt: Date.now(),
    }
    overlays.set(sessionId, data)
  } else {
    data.lastAccessedAt = Date.now()
  }

  return data
}

/**
 * Reports which parts of the overlay are active for a session.
 */
export function getOverlayStatus(sessionId: string): {
  settings: boolean
  tags: boolean
  rules: boolean
} {
  const data = overlays.get(sessionId)
  if (!data) {
    return { settings: false, tags: false, rules: false }
  }

  const now = Date.now()
  if (now - data.lastAccessedAt > getTtlMillis()) {
    overlays.delete(sessionId)
    return { settings: false, tags: false, rules: false }
  }

  const hasSettings = Boolean(data.settings && Object.keys(data.settings).length > 0)
  const hasTags = Object.keys(data.tags).length > 0
  const hasRules =
    data.rules.added.length > 0 ||
    Object.keys(data.rules.edited).length > 0 ||
    data.rules.tombstoned.length > 0

  return { settings: hasSettings, tags: hasTags, rules: hasRules }
}

/**
 * Clears overlay for a session.
 */
export function clearSessionOverlay(sessionId: string): boolean {
  return overlays.delete(sessionId)
}

/**
 * Clears all session overlays (used by dev reset).
 */
export function clearAllSessionOverlays(): void {
  overlays.clear()
}

/**
 * Applies overlay rules on top of seed rules.
 */
export function applyRulesOverlay(
  seedRules: EventMappingRule[],
  rulesOverlay: SessionRulesOverlay
): MappingRuleView[] {
  const tombstonedSet = new Set(rulesOverlay.tombstoned)
  const result: MappingRuleView[] = []

  // Process seed rules
  for (const rule of seedRules) {
    if (tombstonedSet.has(rule.id)) {
      continue
    }
    const edits = rulesOverlay.edited[rule.id]
    if (edits) {
      result.push({
        ...rule,
        ...edits,
        source: 'session',
        edited: true,
      })
    } else {
      result.push({
        ...rule,
        source: 'seed',
        edited: false,
      })
    }
  }

  // Append added rules
  for (const added of rulesOverlay.added) {
    if (!tombstonedSet.has(added.id)) {
      result.push({
        ...added,
        source: 'session',
        edited: false,
      })
    }
  }

  return result
}

/**
 * Applies overlay tag overrides on top of entitlements.
 */
export function applyTagsOverlay(
  entitlements: Entitlement[],
  tagsOverlay: Record<string, SessionTagOverride>
): Entitlement[] {
  return entitlements.map((ent) => {
    const override = tagsOverlay[ent.id]
    if (!override) return ent
    return {
      ...ent,
      ...(override.privilegeLevel ? { privilegeLevel: override.privilegeLevel } : {}),
      ...(override.dataSensitivity ? { dataSensitivity: override.dataSensitivity } : {}),
      ...(override.categories ? { categories: override.categories } : {}),
    }
  })
}

/**
 * Merges effective settings with overlay settings.
 */
export function applySettingsOverlay(
  baseSettings: Settings,
  settingsOverlay?: Partial<Settings>
): Settings {
  if (!settingsOverlay) return baseSettings
  return {
    ...baseSettings,
    ...settingsOverlay,
    unusedWindowDays: {
      ...baseSettings.unusedWindowDays,
      ...(settingsOverlay.unusedWindowDays ?? {}),
    },
    weights: {
      ...baseSettings.weights,
      ...(settingsOverlay.weights ?? {}),
    },
    detectorsEnabled: {
      ...baseSettings.detectorsEnabled,
      ...(settingsOverlay.detectorsEnabled ?? {}),
    },
  }
}
