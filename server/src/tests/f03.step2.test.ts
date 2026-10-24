import { describe, it, expect } from 'vitest'
import { MemoryStore } from '../store/MemoryStore.js'
import {
  findMatchingRule,
  matchesActionPattern,
  countLiteralCharacters,
} from '../engine-ext/glob.js'
import { computeLiveMapping } from '../engine-ext/mappingLive.js'
import {
  getAppCoverageDays,
  getCoverageStart,
  computeObservedDaysUserApp,
  computeObservedDaysUserEntitlement,
  getEffectiveWindowDays,
} from '../engine-ext/observationLive.js'
import {
  classifyUsageDeterministic,
  isDormantAccount,
} from '../engine-ext/usageLive.js'
import {
  getGuardText,
  getCoverageText,
  getBlastRadiusText,
  getAppRetentionNote,
} from '../engine-ext/guardText.js'
import { computeBlastRadius } from '../engine-ext/blastRadius.js'
import { computeRecommendationCard } from '../engine-ext/recommendLive.js'
import { users as frontendUsers, entitlements as frontendEntitlements } from '../../../src/data.js'
import { DEMO_NOW } from '../clock.js'
import type { App, Settings } from '@contract'
import type { EventMappingRule } from '../types/extra.f03.js'

describe('Step 2: Engine-ext and Store Property Tests', () => {
  const store = new MemoryStore()
  const defaultSettings: Settings = {
    unusedWindowDays: { admin: 45, standard: 180 },
    peerThresholdPct: 10,
    minPeerCount: 5,
    graceDays: 30,
    staleGrantDays: 365,
    staleReviewDays: 180,
    blastRadiusMinCoverageDays: 90,
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

  // TEST 1: PROPERTY: unused is never emitted when observedDays < windowDays
  describe('Test 1: Invariant Property - unused never emitted when observedDays < windowDays', () => {
    it('enforces invariant over every (user, entitlement) pair across baseline', () => {
      for (const u of frontendUsers) {
        for (const e of frontendEntitlements) {
          const app = e.app.toLowerCase().replace(' ', '_') as App
          const covDays = getAppCoverageDays(app, false)
          const covStart = getCoverageStart(covDays, DEMO_NOW)
          const observed = computeObservedDaysUserEntitlement(u.startDate, covStart, null, DEMO_NOW)
          const windowDays = e.level === 'admin' ? defaultSettings.unusedWindowDays.admin : defaultSettings.unusedWindowDays.standard

          const result = classifyUsageDeterministic({
            observedDays: observed,
            windowDays,
            lastUsedAt: null,
            dormantAccount: false,
            now: DEMO_NOW,
          })

          if (observed < windowDays) {
            expect(result.state).not.toBe('unused')
            expect(result.state).toBe('unknown')
          }
        }
      }
    })

    it('enforces invariant with simulateShortLogs on (all 11 days)', () => {
      for (const u of frontendUsers) {
        for (const e of frontendEntitlements) {
          const app = e.app.toLowerCase().replace(' ', '_') as App
          const covDays = getAppCoverageDays(app, true) // 11 days
          expect(covDays).toBe(11)
          const covStart = getCoverageStart(covDays, DEMO_NOW)
          const observed = computeObservedDaysUserEntitlement(u.startDate, covStart, null, DEMO_NOW)
          const windowDays = e.level === 'admin' ? 45 : 180

          const result = classifyUsageDeterministic({
            observedDays: observed,
            windowDays,
            lastUsedAt: null,
            dormantAccount: false,
            now: DEMO_NOW,
          })

          expect(result.state).not.toBe('unused')
          expect(result.state).toBe('unknown')
        }
      }
    })

    it('enforces invariant with randomized windows (1 to 730) over 1000 trials', () => {
      for (let i = 0; i < 1000; i++) {
        const randWindow = Math.floor(Math.random() * 730) + 1
        const randObserved = Math.floor(Math.random() * 730) + 1
        const hasUse = Math.random() < 0.3
        const lastUsedAt = hasUse ? DEMO_NOW : null

        const result = classifyUsageDeterministic({
          observedDays: randObserved,
          windowDays: randWindow,
          lastUsedAt,
          dormantAccount: false,
          now: DEMO_NOW,
        })

        if (randObserved < randWindow && !hasUse) {
          expect(result.state).toBe('unknown')
          expect(result.state).not.toBe('unused')
        }
      }
    })
  })

  // TEST 2: PROPERTY: unknown never yields Revoke or Downgrade, blastRadius null never exceeds Review
  describe('Test 2: Recommendation Ladder Hard Caps', () => {
    it('unknown usage state never produces Revoke or Downgrade', () => {
      const actions: Array<'keep' | 'review' | 'downgrade' | 'revoke'> = []

      for (let observed = 0; observed < 45; observed += 5) {
        const unknownUsage = classifyUsageDeterministic({
          observedDays: observed,
          windowDays: 45,
          lastUsedAt: null,
          dormantAccount: true,
          now: DEMO_NOW,
        })
        expect(unknownUsage.state).toBe('unknown')

        const rec = computeRecommendationCard({
          usage: unknownUsage,
          blastRadius: { actionsLast90d: 0, ownedSharedResources: 0 },
          confidence: 'high',
          confidenceReason: 'Test high confidence',
          dormantAccount: true,
          hasDowngrade: true,
          coverageDays: 180,
        })

        expect(rec.action).toBe('review')
        expect(rec.action).not.toBe('revoke')
        expect(rec.action).not.toBe('downgrade')
      }
    })

    it('blastRadius null never produces Revoke or Downgrade', () => {
      const unusedUsage = classifyUsageDeterministic({
        observedDays: 180,
        windowDays: 45,
        lastUsedAt: null,
        dormantAccount: true,
        now: DEMO_NOW,
      })

      const rec = computeRecommendationCard({
        usage: unusedUsage,
        blastRadius: null,
        confidence: 'high',
        confidenceReason: 'Test high confidence',
        dormantAccount: true,
        hasDowngrade: true,
        coverageDays: 30, // short logs
      })

      expect(rec.action).toBe('review')
      expect(rec.action).not.toBe('revoke')
      expect(rec.action).not.toBe('downgrade')
    })
  })

  // TEST 8: Mapping glob escape safety, specificity, same-app only, unmapped never counted as use
  describe('Test 8: Mapping glob rules and safety', () => {
    const rules: EventMappingRule[] = [
      { id: 'rule-gw-1', app: 'google_workspace', actionPattern: 'drive.admin.*', entitlementId: 'e-drive-admin', note: 'admin' },
      { id: 'rule-gw-2', app: 'google_workspace', actionPattern: 'drive.admin.update_perms', entitlementId: 'e-drive-admin-specific', note: 'specific' },
      { id: 'rule-gw-3', app: 'google_workspace', actionPattern: 'drive.read', entitlementId: 'e-support-read', note: 'read' },
      { id: 'rule-gh-1', app: 'github', actionPattern: 'repo.*', entitlementId: 'e-gh-any', note: 'gh any' },
      { id: 'rule-gh-2', app: 'github', actionPattern: 'repo.push*', entitlementId: 'e-gh-push', note: 'gh push' },
    ]

    it('never throws or breaks on arbitrary regex metacharacters in pattern', () => {
      const crazyPatterns = [
        'drive.[a-z]+.*',
        'drive.(read|write)',
        'drive.{1,3}',
        'drive.^$*?',
        'drive.*(special)+[abc]',
        'action?name*with$dollar.and+plus',
      ]

      for (const p of crazyPatterns) {
        expect(() => matchesActionPattern('drive.read', p)).not.toThrow()
      }
    })

    it('specificity precedence: most literal characters wins', () => {
      // rule-gw-2 has 24 literal chars, rule-gw-1 has 12 literal chars
      const matched = findMatchingRule('google_workspace', 'drive.admin.update_perms', rules)
      expect(matched).not.toBeNull()
      expect(matched?.id).toBe('rule-gw-2')
      expect(matched?.entitlementId).toBe('e-drive-admin-specific')
    })

    it('same app only: rule for github never matches google_workspace', () => {
      const matched = findMatchingRule('google_workspace', 'repo.push', rules)
      expect(matched).toBeNull()
    })

    it('unmapped events return null and never count as use', () => {
      const mapped = computeLiveMapping(
        {
          id: 'a-unmapped',
          userId: 'u-tara',
          app: 'google_workspace',
          at: '2026-10-12T00:00:00Z',
          action: 'export.csv',
          resource: 'quarter-close',
          actionClass: 'export',
        },
        rules
      )

      expect(mapped.mappedEntitlementId).toBeNull()
      expect(mapped.matchedRuleId).toBeNull()
    })
  })

  // TEST 13: Observation windows, coverage flags, per-app coverageStart, simulateShortLogs
  describe('Test 13: Observation windows calculation', () => {
    it('calculates observedDays correctly for standard users', () => {
      const gwCovDays = getAppCoverageDays('google_workspace', false)
      expect(gwCovDays).toBe(180)
      const covStart = getCoverageStart(gwCovDays, DEMO_NOW)

      // Karthik started 2024-01-05, coverageStart is 180 days ago (2024 is earlier than coverageStart)
      // So observedDays is 180 days
      const karthikObserved = computeObservedDaysUserApp('2024-01-05', covStart, DEMO_NOW)
      expect(karthikObserved).toBe(180)

      // Aarav Khanna started 2026-10-12 (11 days before DEMO_NOW)
      const aaravObserved = computeObservedDaysUserApp('2026-10-12', covStart, DEMO_NOW)
      expect(aaravObserved).toBe(11)
    })

    it('simulateShortLogs forces every app coverageDays to 11', () => {
      expect(getAppCoverageDays('google_workspace', true)).toBe(11)
      expect(getAppCoverageDays('microsoft_entra', true)).toBe(11)
      expect(getAppCoverageDays('github', true)).toBe(11)
    })
  })

  // TEST 14: Dormant account definition
  describe('Test 14: Dormant account determination', () => {
    it('is dormant only when no app events in window AND observedDays >= window', () => {
      expect(isDormantAccount(false, 180, 45)).toBe(true)
      expect(isDormantAccount(false, 30, 45)).toBe(false) // observed < window -> not dormant
      expect(isDormantAccount(true, 180, 45)).toBe(false) // has event -> not dormant
    })
  })

  // TEST 17: Guard text and coverage text exact strings
  describe('Test 17: Guard text exact strings matching spec', () => {
    it('matches exact Unknown guard text', () => {
      expect(getGuardText('unknown', 11, 45)).toBe('Only 11 days of logs. Cannot judge.')
      expect(getGuardText('unknown', 30, 180)).toBe('Only 30 days of logs. Cannot judge.')
    })

    it('matches exact Unused guard text with covered clamp', () => {
      expect(getGuardText('unused', 180, 45)).toBe('Unused: 0 uses in 45 of 45 observed days')
      expect(getGuardText('unused', 180, 180)).toBe('Unused: 0 uses in 180 of 180 observed days')
    })

    it('matches exact Coverage bar text', () => {
      expect(getCoverageText(180, 45)).toBe('45 of 45 days observed')
      expect(getCoverageText(11, 45)).toBe('11 of 45 days observed')
    })

    it('matches exact Blast radius null text', () => {
      expect(getBlastRadiusText(null, 30)).toBe('Not available: only 30 days of logs')
      expect(getBlastRadiusText(null, 11)).toBe('Not available: only 11 days of logs')
    })

    it('returns Entra connector retention note', () => {
      expect(getAppRetentionNote('microsoft_entra')).toBe(
        'Mirrors a 30-day documented retention assumption; usage can be unknown.'
      )
      expect(getAppRetentionNote('google_workspace')).toBeNull()
    })
  })
})
