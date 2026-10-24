import type { App, Entitlement, Settings, User } from '@contract'
import type { DataStore } from '../store/DataStore.js'
import type {
  ActivityEvent,
  CoverageInfo,
  EventMappingRule,
  ScoreBreakdown,
  UsageRow,
} from '../types/extra.f03.js'
import { DEMO_NOW } from '../clock.js'
import { computeLiveMapping } from '../engine-ext/mappingLive.js'
import {
  computeObservedDaysUserApp,
  computeObservedDaysUserEntitlement,
  getAppCoverageDays,
  getCoverageStart,
  getEffectiveWindowDays,
} from '../engine-ext/observationLive.js'
import {
  classifyUsageDeterministic,
  isDormantAccount,
} from '../engine-ext/usageLive.js'
import { computeBlastRadius } from '../engine-ext/blastRadius.js'
import { computeRecommendationCard } from '../engine-ext/recommendLive.js'
import { computeRiskScore } from '../engine-ext/scoreLive.js'
import {
  getCoverageText,
  getGuardText,
  getAppRetentionNote,
} from '../engine-ext/guardText.js'
import {
  applyRulesOverlay,
  applySettingsOverlay,
  applyTagsOverlay,
  getSessionOverlay,
} from '../engine-ext/overlay.js'
import { findings as seedFindings, settings as seedSettingsRaw } from '../../../src/data.js'
import { mapApp } from '../mappers.js'

export const BASE_SETTINGS: Settings = {
  unusedWindowDays: { admin: seedSettingsRaw.adminWindowDays || 45, standard: seedSettingsRaw.standardWindowDays || 180 },
  peerThresholdPct: seedSettingsRaw.peerThresholdPct || 10,
  minPeerCount: seedSettingsRaw.minPeerCount || 5,
  graceDays: seedSettingsRaw.graceDays || 30,
  staleGrantDays: seedSettingsRaw.staleGrantDays || 365,
  staleReviewDays: seedSettingsRaw.staleReviewDays || 180,
  blastRadiusMinCoverageDays: seedSettingsRaw.coverageMinDays || 90,
  weights: { severity: 0.3, sensitivity: 0.3, evidenceStrength: 0.2, staleness: 0.2 },
  detectorsEnabled: {
    unused: true,
    stale_grant: true,
    peer_outlier: true,
    mover_carryover: true,
    manual: true,
  },
  version: 1,
}

export interface EffectiveConfig {
  settings: Settings
  entitlements: Entitlement[]
  rules: EventMappingRule[]
}

export async function getEffectiveConfig(
  store: DataStore,
  sessionId?: string
): Promise<EffectiveConfig> {
  const [entitlementsPage, seedRules] = await Promise.all([
    store.listEntitlements(500, 0),
    store.listMappingRules(),
  ])

  if (!sessionId) {
    return {
      settings: BASE_SETTINGS,
      entitlements: entitlementsPage.items,
      rules: seedRules,
    }
  }

  const overlay = getSessionOverlay(sessionId)
  const effectiveSettings = applySettingsOverlay(BASE_SETTINGS, overlay.settings)
  const effectiveEntitlements = applyTagsOverlay(entitlementsPage.items, overlay.tags)
  const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)

  return {
    settings: effectiveSettings,
    entitlements: effectiveEntitlements,
    rules: effectiveRules,
  }
}

/**
 * Computes all UsageRows for the current active configuration.
 */
export async function computeAllUsageRows(
  store: DataStore,
  sessionId?: string,
  now = DEMO_NOW
): Promise<UsageRow[]> {
  const [usersPage, config, allEventsPage, connectors, shortLogsFlag, connectorErrorApps] =
    await Promise.all([
      store.listUsers(500, 0),
      getEffectiveConfig(store, sessionId),
      store.listActivityEvents({}, 1000, 0),
      store.listConnectors(),
      store.getDevFlag('shortLogs'),
      store.getDevFlag('connectorErrorApps') as Promise<string[] | null>,
    ])

  const simulateShortLogs = Boolean(shortLogsFlag)
  const errorAppsSet = new Set<string>((connectorErrorApps || []).map((a) => a.toLowerCase()))

  // Connectors map
  const connMap = new Map(connectors.map((c) => [c.app, c]))

  // Live map all events
  const liveMappedEvents = allEventsPage.items.map((ev) =>
    computeLiveMapping(ev, config.rules)
  )

  const rows: UsageRow[] = []

  // Pre-index seed findings for findingId, confidence, etc.
  const findingByPair = new Map(
    seedFindings.map((f) => [`${f.userId}-${f.entitlementId}`, f])
  )

  for (const user of usersPage.items) {
    const userEvents = liveMappedEvents.filter((ev) => ev.userId === user.id)

    for (const ent of config.entitlements) {
      const app = ent.app
      const connector = connMap.get(app)
      const isRevoked = connector?.status === 'revoked'
      const hasError = errorAppsSet.has(app)
      const stale = isRevoked || hasError

      const covDays = getAppCoverageDays(app, simulateShortLogs, connector?.coverageDays)
      const covStart = getCoverageStart(covDays, now)

      // Observed days for user+entitlement
      const observedDaysEnt = computeObservedDaysUserEntitlement(
        user.startDate,
        covStart,
        null,
        now
      )

      // Observed days for user+app (for dormant determination)
      const observedDaysApp = computeObservedDaysUserApp(user.startDate, covStart, now)

      const windowDays = getEffectiveWindowDays(ent.privilegeLevel, config.settings)

      // Find events mapped to this entitlement for this user
      const mappedEvents = userEvents.filter(
        (ev) => ev.mappedEntitlementId === ent.id
      )

      // Last used date
      let lastUsedAt: string | null = null
      if (mappedEvents.length > 0) {
        mappedEvents.sort((a, b) => b.at.localeCompare(a.at))
        lastUsedAt = mappedEvents[0].at
      }

      // Check if user has any event in this app within window
      const nowDate = Date.parse(now)
      const windowMillis = windowDays * 86_400_000
      const hasAppEventInWindow = userEvents.some((ev) => {
        if (ev.app !== app) return false
        const t = Date.parse(ev.at)
        return t >= nowDate - windowMillis && t <= nowDate
      })

      const dormant = isDormantAccount(hasAppEventInWindow, observedDaysApp, windowDays)

      // Classify usage
      const usage = classifyUsageDeterministic({
        observedDays: observedDaysEnt,
        windowDays,
        lastUsedAt,
        dormantAccount: dormant,
        now,
      })

      // Blast radius
      const blastRadius = computeBlastRadius(
        app,
        userEvents,
        covDays,
        config.settings.blastRadiusMinCoverageDays,
        now
      )

      // Check seed finding for confidence override
      const seedFinding = findingByPair.get(`${user.id}-${ent.id}`)
      const confidence =
        ent.seasonal
          ? 'low'
          : seedFinding?.confidence || (observedDaysEnt >= windowDays ? 'high' : 'low')

      const confidenceReason =
        ent.seasonal
          ? 'Seasonal permission; history under 365 days.'
          : seedFinding?.confidenceReason ||
            (usage.state === 'unknown'
              ? `Only ${observedDaysEnt} days of logs.`
              : `${observedDaysEnt} days observed with ${mappedEvents.length} mapped activity events.`)

      // Recommendation card
      const recommendation = computeRecommendationCard({
        usage,
        blastRadius,
        confidence,
        confidenceReason,
        dormantAccount: dormant,
        hasDowngrade: Boolean(ent.downgradeToId),
        findingType: seedFinding?.type,
        coverageDays: covDays,
        isSeasonal: ent.seasonal,
      })

      // Risk score & breakdown
      const daysSinceLastUse = lastUsedAt
        ? Math.floor((nowDate - Date.parse(lastUsedAt)) / 86_400_000)
        : null

      const observedCoveragePct = Math.min(1.0, observedDaysEnt / windowDays)
      const { riskScore, scoreBreakdown } = computeRiskScore(
        ent,
        observedCoveragePct,
        daysSinceLastUse,
        config.settings
      )

      // Coverage info
      const coveredDays = Math.min(observedDaysEnt, windowDays)
      const coverage: CoverageInfo = {
        coveredDays,
        windowDays,
        observedDays: observedDaysEnt,
        coverageDays: covDays,
        text: getCoverageText(observedDaysEnt, windowDays),
      }

      const guardText = getGuardText(usage.state, observedDaysEnt, windowDays)
      const evidenceIds = [
        `ev-usage-${user.id}-${ent.id}`,
        `ev-cov-${app}-${now.slice(0, 10)}`,
      ]

      const row: UsageRow = {
        userId: user.id,
        displayName: user.displayName,
        pseudonym: user.pseudonym,
        app,
        entitlementId: ent.id,
        entitlementName: ent.name,
        sensitivityChip: ent.dataSensitivity,
        privileged: ent.privilegeLevel === 'admin' || ent.dataSensitivity === 'pii_financial',
        categories: ent.categories,
        usage,
        coverage,
        guardText,
        recommendation,
        riskScore: seedFinding?.riskScore ?? riskScore,
        scoreBreakdown,
        findingId: seedFinding?.id || null,
        evidenceIds,
        stale,
        seasonal: Boolean(ent.seasonal),
      }

      rows.push(row)
    }
  }

  return rows
}
