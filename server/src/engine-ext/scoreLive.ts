import type { Entitlement, Settings } from '@contract'
import type { ScoreBreakdown } from '../types/extra.f03.js'
import { score as engineScore } from '../../../src/engine/index.js'

export function computeRiskScore(
  entitlement: Entitlement,
  observedCoveragePct: number,
  daysSinceLastUse: number | null,
  settings: Settings
): { riskScore: number; scoreBreakdown: ScoreBreakdown } {
  // Severity: privilege level
  const severity =
    entitlement.privilegeLevel === 'admin'
      ? 1.0
      : entitlement.privilegeLevel === 'write'
      ? 0.7
      : 0.3

  // Sensitivity: data sensitivity
  const sensitivity =
    entitlement.dataSensitivity === 'pii_financial'
      ? 1.0
      : entitlement.dataSensitivity === 'confidential'
      ? 0.8
      : entitlement.dataSensitivity === 'internal'
      ? 0.5
      : 0.2

  // Evidence strength: coverage completeness (clamped 0 to 1)
  const evidenceStrength = Math.min(1.0, Math.max(0.1, observedCoveragePct))

  // Staleness: staleness score based on daysSinceLastUse or default
  const staleness = daysSinceLastUse !== null
    ? Math.min(1.0, daysSinceLastUse / (settings.staleGrantDays || 365))
    : 0.5

  const weights = settings.weights || {
    severity: 0.3,
    sensitivity: 0.3,
    evidenceStrength: 0.2,
    staleness: 0.2,
  }

  const finalScore = engineScore({
    severity,
    sensitivity,
    evidenceStrength,
    staleness,
    weights,
  })

  return {
    riskScore: finalScore,
    scoreBreakdown: {
      severity,
      sensitivity,
      evidenceStrength,
      staleness,
      weights,
      finalScore,
    },
  }
}
