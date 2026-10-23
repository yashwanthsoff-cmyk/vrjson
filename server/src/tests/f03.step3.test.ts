import { describe, it, expect } from 'vitest'
import { MemoryStore } from '../store/MemoryStore.js'
import { computeAllUsageRows } from '../services/usageEngineService.js'
import { evaluateF03Scenarios } from '../services/scenarioF03Service.js'
import { getGuardText } from '../engine-ext/guardText.js'

describe('Step 3: Scenario Verification (S3, S6, S7, S8, Test 25)', () => {
  const store = new MemoryStore()

  // TEST 3: S3 Karthik Menon
  it('Test 3: S3 Karthik Menon - unused, dormantAccount true, observed 180, blast radius 0/0, recommendation Revoke', async () => {
    const rows = await computeAllUsageRows(store)
    const karthikRow = rows.find(
      (r) => r.userId === 'u-karthik' && r.entitlementId === 'e-drive-admin'
    )

    expect(karthikRow).toBeDefined()
    expect(karthikRow?.usage.state).toBe('unused')
    expect(karthikRow?.usage.dormantAccount).toBe(true)
    expect(karthikRow?.usage.observedDays).toBe(180)
    expect(karthikRow?.recommendation.blastRadius).toEqual({
      actionsLast90d: 0,
      ownedSharedResources: 0,
    })
    expect(karthikRow?.recommendation.action).toBe('revoke')

    // Exact guard text format verification
    const covered = Math.min(karthikRow!.usage.observedDays, karthikRow!.usage.windowDays)
    expect(karthikRow?.guardText).toBe(`Unused: 0 uses in ${covered} of ${karthikRow!.usage.windowDays} observed days`)
    // Also test with standard 180-day window
    expect(getGuardText('unused', 180, 180)).toBe('Unused: 0 uses in 180 of 180 observed days')
  })

  // TEST 4: S6 Aarav Khanna
  it('Test 4: S6 Aarav Khanna - unknown, guard text "Only 11 days of logs. Cannot judge.", no Revoke or Downgrade', async () => {
    const rows = await computeAllUsageRows(store)
    const aaravRow = rows.find(
      (r) => r.userId === 'u-aarav' && r.entitlementId === 'e-github-write'
    )

    expect(aaravRow).toBeDefined()
    expect(aaravRow?.usage.state).toBe('unknown')
    expect(aaravRow?.guardText).toBe('Only 11 days of logs. Cannot judge.')
    expect(aaravRow?.recommendation.action).not.toBe('revoke')
    expect(aaravRow?.recommendation.action).not.toBe('downgrade')
    expect(aaravRow?.recommendation.action).toBe('review')
  })

  // TEST 5: S7 Entra rows
  it('Test 5: S7 - every Entra usage row is unknown, blastRadius null, recommendation capped at Review, retention note present', async () => {
    const rows = await computeAllUsageRows(store)
    const entraRows = rows.filter((r) => r.app === 'microsoft_entra')

    expect(entraRows.length).toBeGreaterThan(0)
    for (const row of entraRows) {
      expect(row.usage.state).toBe('unknown')
      expect(row.recommendation.blastRadius).toBeNull()
      expect(row.recommendation.action).not.toBe('revoke')
      expect(row.recommendation.action).not.toBe('downgrade')
      expect(row.recommendation.blastRadiusText).toBe('Not available: only 30 days of logs')
    }
  })

  // TEST 6: S8 Seasonal permission
  it('Test 6: S8 - the seasonal quarter-close export permission has confidence low and recommendation Review', async () => {
    const rows = await computeAllUsageRows(store)
    const taraExportRow = rows.find(
      (r) => r.userId === 'u-tara' && r.entitlementId === 'e-export'
    )

    expect(taraExportRow).toBeDefined()
    expect(taraExportRow?.seasonal).toBe(true)
    expect(taraExportRow?.recommendation.confidence).toBe('low')
    expect(taraExportRow?.recommendation.action).toBe('review')
  })

  // TEST 25: Scenario endpoint evaluator
  it('Test 25: evaluateF03Scenarios reports S3, S6, S7, S8 all passing with required label', async () => {
    const result = await evaluateF03Scenarios(store)

    expect(result.label).toBe(
      'Checks that the logic reproduces planted scenarios. Not an accuracy measure.'
    )
    expect(result.allPassed).toBe(true)
    expect(result.scenarios.length).toBe(4)

    for (const sc of result.scenarios) {
      expect(sc.pass).toBe(true)
    }
  })
})
