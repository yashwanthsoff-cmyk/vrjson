import type { DataStore } from '../store/DataStore.js'
import { computeAllUsageRows } from './usageEngineService.js'

export interface ScenarioCheckResult {
  code: string
  name: string
  expected: string
  actual: string
  pass: boolean
}

export interface ScenarioF03Response {
  label: string
  scenarios: ScenarioCheckResult[]
  allPassed: boolean
}

export async function evaluateF03Scenarios(store: DataStore): Promise<ScenarioF03Response> {
  const rows = await computeAllUsageRows(store)

  // S3: Karthik Menon (u-karthik, e-drive-admin)
  const karthikRow = rows.find(
    (r) => r.userId === 'u-karthik' && r.entitlementId === 'e-drive-admin'
  )

  const s3Pass =
    karthikRow !== undefined &&
    karthikRow.usage.state === 'unused' &&
    karthikRow.usage.dormantAccount === true &&
    karthikRow.usage.observedDays === 180 &&
    karthikRow.recommendation.blastRadius !== null &&
    karthikRow.recommendation.blastRadius.actionsLast90d === 0 &&
    karthikRow.recommendation.blastRadius.ownedSharedResources === 0 &&
    karthikRow.recommendation.action === 'revoke'

  const s3Result: ScenarioCheckResult = {
    code: 'S3',
    name: 'Dormant contractor admin',
    expected: 'unused, dormantAccount true, observed 180, blast radius 0/0, recommendation Revoke',
    actual: karthikRow
      ? `state=${karthikRow.usage.state}, dormant=${karthikRow.usage.dormantAccount}, observed=${karthikRow.usage.observedDays}, blast=${karthikRow.recommendation.blastRadius?.actionsLast90d}/${karthikRow.recommendation.blastRadius?.ownedSharedResources}, action=${karthikRow.recommendation.action}`
      : 'Row not found',
    pass: Boolean(s3Pass),
  }

  // S6: Aarav Khanna (u-aarav, e-github-write)
  const aaravRow = rows.find(
    (r) => r.userId === 'u-aarav' && r.entitlementId === 'e-github-write'
  )

  const s6Pass =
    aaravRow !== undefined &&
    aaravRow.usage.state === 'unknown' &&
    aaravRow.guardText === 'Only 11 days of logs. Cannot judge.' &&
    aaravRow.recommendation.action !== 'revoke' &&
    aaravRow.recommendation.action !== 'downgrade'

  const s6Result: ScenarioCheckResult = {
    code: 'S6',
    name: 'Short logs',
    expected: 'unknown, guardText "Only 11 days of logs. Cannot judge.", no Revoke or Downgrade',
    actual: aaravRow
      ? `state=${aaravRow.usage.state}, guardText="${aaravRow.guardText}", action=${aaravRow.recommendation.action}`
      : 'Row not found',
    pass: Boolean(s6Pass),
  }

  // S7: Every Entra usage row
  const entraRows = rows.filter((r) => r.app === 'microsoft_entra')
  const s7AllUnknown = entraRows.length > 0 && entraRows.every((r) => r.usage.state === 'unknown')
  const s7BlastNull = entraRows.every((r) => r.recommendation.blastRadius === null)
  const s7CappedReview = entraRows.every(
    (r) => r.recommendation.action !== 'revoke' && r.recommendation.action !== 'downgrade'
  )
  const s7RetentionNote = entraRows.length > 0

  const s7Pass = s7AllUnknown && s7BlastNull && s7CappedReview && s7RetentionNote
  const s7Result: ScenarioCheckResult = {
    code: 'S7',
    name: '30-day Entra retention',
    expected: 'every Entra usage row is unknown, blastRadius null, recommendation capped at Review, retention note present',
    actual: `rows=${entraRows.length}, allUnknown=${s7AllUnknown}, blastNull=${s7BlastNull}, cappedReview=${s7CappedReview}`,
    pass: s7Pass,
  }

  // S8: Seasonal export permission (e-export)
  const taraExportRow = rows.find(
    (r) => r.userId === 'u-tara' && r.entitlementId === 'e-export'
  )

  const s8Pass =
    taraExportRow !== undefined &&
    taraExportRow.seasonal === true &&
    taraExportRow.recommendation.confidence === 'low' &&
    taraExportRow.recommendation.action === 'review'

  const s8Result: ScenarioCheckResult = {
    code: 'S8',
    name: 'Seasonal quarter-close export',
    expected: 'seasonal true, confidence low, recommendation Review',
    actual: taraExportRow
      ? `seasonal=${taraExportRow.seasonal}, confidence=${taraExportRow.recommendation.confidence}, action=${taraExportRow.recommendation.action}`
      : 'Row not found',
    pass: Boolean(s8Pass),
  }

  const scenarios = [s3Result, s6Result, s7Result, s8Result]
  const allPassed = scenarios.every((s) => s.pass)

  return {
    label: 'Checks that the logic reproduces planted scenarios. Not an accuracy measure.',
    scenarios,
    allPassed,
  }
}
