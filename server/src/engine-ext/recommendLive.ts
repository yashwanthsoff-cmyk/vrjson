import type { Recommendation, UsageResult } from '@contract'
import type { RecommendationCardData } from '../types/extra.f03.js'
import { getBlastRadiusText } from './guardText.js'

export interface RecommendInput {
  usage: UsageResult
  blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  dormantAccount: boolean
  hasDowngrade: boolean
  findingType?: string
  coverageDays: number
  isSeasonal?: boolean
  hasActiveException?: boolean
}

/**
 * Computes recommendation and reasons according to the recommendation ladder.
 * Hard caps:
 * - unknown anywhere -> review
 * - blastRadius null -> review
 * - low confidence, stale_grant, manual -> review
 */
export function computeRecommendationCard(input: RecommendInput): RecommendationCardData {
  const {
    usage,
    blastRadius,
    confidence,
    confidenceReason,
    dormantAccount,
    hasDowngrade,
    findingType,
    coverageDays,
    isSeasonal,
  } = input

  const reasons: string[] = []
  let action: 'keep' | 'review' | 'downgrade' | 'revoke'

  if (usage.state === 'unknown') {
    action = 'review'
    reasons.push('Coverage is shorter than the configured window.')
    reasons.push('Unknown usage cannot be revoked or downgraded.')
    reasons.push('Review manually once more history is available.')
  } else if (blastRadius === null) {
    action = 'review'
    reasons.push('Blast radius is not available due to short observation coverage.')
    reasons.push('Recommendations are capped at Review when blast radius cannot be calculated.')
  } else if (isSeasonal) {
    action = 'review'
    reasons.push('Permission is marked seasonal.')
    reasons.push('Seasonal permissions are reviewed rather than revoked.')
  } else if (confidence === 'low') {
    action = 'review'
    reasons.push('Signal confidence is low.')
    reasons.push('Low confidence requires manual review before action.')
  } else if (findingType === 'stale_grant' || findingType === 'manual') {
    action = 'review'
    reasons.push('Admin or high-sensitivity grant requires human review.')
  } else if (usage.state === 'used') {
    action = 'review'
    reasons.push('Mapped activity exists in the observation window.')
  } else if (blastRadius.ownedSharedResources > 0 || blastRadius.actionsLast90d > 0) {
    action = 'review'
    reasons.push('Recent actions or owned shared resources detected in blast radius.')
  } else if (dormantAccount) {
    action = 'revoke'
    reasons.push('Usage is unused for the observation window.')
    reasons.push('Full coverage is available.')
    reasons.push('No owned shared resources or recent actions.')
    reasons.push('Dormant account makes revoke the highest available recommendation.')
  } else if (hasDowngrade) {
    action = 'downgrade'
    reasons.push('Usage is unused for the observation window.')
    reasons.push('Account is active in the app, but this high privilege is unused.')
    reasons.push('A lower privilege entitlement is available for downgrade.')
  } else {
    action = 'revoke'
    reasons.push('Usage is unused for the observation window.')
    reasons.push('No lower privilege replacement available.')
    reasons.push('Revoke recommendation is appropriate.')
  }

  // Hard assertion: An 'unknown' row NEVER carries Revoke or Downgrade
  if (usage.state === 'unknown' && (action === 'revoke' || action === 'downgrade')) {
    const msg = `Assertion failed: unknown row received ${action} recommendation`
    if (process.env.NODE_ENV === 'test') {
      throw new Error(msg)
    }
    action = 'review'
  }

  // Hard assertion: blastRadius null NEVER exceeds Review
  if (blastRadius === null && (action === 'revoke' || action === 'downgrade')) {
    const msg = `Assertion failed: blastRadius null received ${action} recommendation`
    if (process.env.NODE_ENV === 'test') {
      throw new Error(msg)
    }
    action = 'review'
  }

  return {
    action,
    confidence,
    confidenceReason,
    blastRadius,
    blastRadiusText: getBlastRadiusText(blastRadius, coverageDays),
    reasons,
  }
}
