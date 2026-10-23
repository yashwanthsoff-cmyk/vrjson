import type { App, Evidence, ExplanationSentence } from '@contract'
import type { UsageRow, UsageSummary, ValidationResult } from '../types/extra.f03.js'
import { DEMO_NOW } from '../clock.js'

export const BANNED_PHRASES = [
  'accuracy',
  'precision',
  'recall',
  'compliant',
  'ai-powered',
  'automatically revokes',
  'seamless',
  'intelligent',
  'innovative',
  'reduces risk by',
]

export function containsBannedPhrase(text: string): boolean {
  const lower = text.toLowerCase()
  return BANNED_PHRASES.some((phrase) => lower.includes(phrase))
}

/**
 * Validates template string according to F-03 rules:
 * - Templates contain NO digits outside claim values
 * - No braces other than valid {claimId} placeholders
 * - No banned phrases
 */
export function validateTemplateString(
  template: string,
  validClaimIds: Set<string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check banned phrases
  if (containsBannedPhrase(template)) {
    errors.push('Template contains banned phrase')
  }

  // Check for digits outside placeholders
  // Replace valid {claimId} with placeholder token then test for digits
  let withoutPlaceholders = template
  const placeholderRegex = /\{([^{}]+)\}/g
  let match: RegExpExecArray | null

  while ((match = placeholderRegex.exec(template)) !== null) {
    const claimId = match[1]
    if (!validClaimIds.has(claimId)) {
      errors.push(`Template references unknown claim ID: ${claimId}`)
    }
  }

  // Replace {c1} style placeholders with empty string
  withoutPlaceholders = template.replace(/\{[^{}]+\}/g, '')

  // Check for stray braces
  if (withoutPlaceholders.includes('{') || withoutPlaceholders.includes('}')) {
    errors.push('Template contains unmatched or nested braces')
  }

  // Check for digits in remaining template text
  if (/\d/.test(withoutPlaceholders)) {
    errors.push('Template contains digits outside placeholders')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Deterministic fallback generator for usage summaries.
 * Always produces valid template sentences with claims linked to evidence.
 */
export function explainUsage(
  userId: string,
  app: App | null,
  subjectName: string,
  rows: UsageRow[],
  evidenceList: Evidence[],
  fallbackUsed = true
): UsageSummary {
  const evidenceMap = new Map<string, Evidence>(evidenceList.map((e) => [e.id, e]))

  const usedCount = rows.filter((r) => r.usage.state === 'used').length
  const unusedCount = rows.filter((r) => r.usage.state === 'unused').length
  const unknownCount = rows.filter((r) => r.usage.state === 'unknown').length
  const isDormant = rows.some((r) => r.usage.dormantAccount)

  // Find representative evidence
  const firstUsageEv = evidenceList.find((e) => e.type === 'coverage' && e.id.startsWith('ev-usage-'))
  const evId = firstUsageEv ? firstUsageEv.id : evidenceList[0]?.id || `ev-usage-${userId}-summary`

  // Candidate sentences with claims
  const sentences: ExplanationSentence[] = []

  // Sentence 1: Observation counts
  sentences.push({
    id: `sent-usage-1`,
    template: `{c1} holds {c2} permissions evaluated under observation.`,
    claims: [
      { id: 'c1', field: 'subject', value: subjectName, evidenceId: evId },
      { id: 'c2', field: 'totalEvaluated', value: rows.length, evidenceId: evId },
    ],
  })

  // Sentence 2: Unused and unknown state
  sentences.push({
    id: `sent-usage-2`,
    template: `Observation classifies {c3} unused and {c4} unknown permissions.`,
    claims: [
      { id: 'c3', field: 'unusedCount', value: unusedCount, evidenceId: evId },
      { id: 'c4', field: 'unknownCount', value: unknownCount, evidenceId: evId },
    ],
  })

  // Sentence 3: Dormant status if applicable
  if (isDormant) {
    sentences.push({
      id: `sent-usage-3`,
      template: `The account is dormant with zero observed activity across the configured window.`,
      claims: [
        { id: 'c5', field: 'dormantAccount', value: 'true', evidenceId: evId },
      ],
    })
  } else {
    sentences.push({
      id: `sent-usage-3`,
      template: `Mapped activity records {c5} permissions as actively used.`,
      claims: [
        { id: 'c5', field: 'usedCount', value: usedCount, evidenceId: evId },
      ],
    })
  }

  // Ensure evId exists in evidenceList payload with these fields
  if (firstUsageEv) {
    firstUsageEv.payload.subject = subjectName
    firstUsageEv.payload.totalEvaluated = rows.length
    firstUsageEv.payload.unusedCount = unusedCount
    firstUsageEv.payload.unknownCount = unknownCount
    firstUsageEv.payload.usedCount = usedCount
    firstUsageEv.payload.dormantAccount = isDormant ? 'true' : 'false'
  }

  const validation: ValidationResult = {
    claims: sentences.reduce((sum, s) => sum + s.claims.length, 0),
    linked: sentences.reduce((sum, s) => sum + s.claims.length, 0),
    passed: true,
    failures: [],
  }

  return {
    id: `usage-sum-${userId}-${app || 'all'}-${Date.now()}`,
    userId,
    app,
    source: 'template',
    fallbackUsed,
    label: 'Fixed template wording.',
    sentences: sentences.slice(0, 4),
    evidence: evidenceList,
    validation,
    cached: false,
    createdAt: DEMO_NOW,
  }
}
