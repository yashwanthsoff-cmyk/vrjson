import type { Claim, Evidence, Recommendation, UsageResult } from '../types/contract'

export const DEMO_NOW = '2026-10-23T00:00:00Z'

export function observedDays(coverageStart: string, userStart: string, now = DEMO_NOW) {
  const start = Math.max(Date.parse(coverageStart), Date.parse(userStart))
  return Math.max(0, Math.floor((Date.parse(now) - start) / 86_400_000))
}

export function classifyUsage(input: { observedDays: number; windowDays: number; lastUsedAt: string | null; evidenceIds?: string[]; dormantAccount?: boolean }): UsageResult {
  const state = input.observedDays < input.windowDays ? 'unknown' : input.lastUsedAt && Date.parse(input.lastUsedAt) >= Date.parse(DEMO_NOW) - input.windowDays * 86_400_000 ? 'used' : 'unused'
  return { state, lastUsedAt: input.lastUsedAt, observedDays: input.observedDays, windowDays: input.windowDays, evidenceIds: input.evidenceIds ?? [], dormantAccount: Boolean(input.dormantAccount), decisionPath: state === 'unknown' ? [`Only ${input.observedDays} days of logs. Cannot judge.`] : state === 'unused' ? [`No mapped events in the ${input.windowDays}-day window.`, `${input.observedDays} of ${input.windowDays} days observed.`] : ['A mapped event falls inside the active observation window.'] }
}

export function recommend(input: { usage: UsageResult; blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null; confidence: 'high' | 'medium' | 'low'; dormantAccount: boolean; hasDowngrade: boolean; type: string }): Recommendation {
  if (input.usage.state === 'unknown' || input.blastRadius === null) return 'review'
  if (input.confidence === 'low' || input.type === 'stale_grant' || input.type === 'manual') return 'review'
  if (input.usage.state === 'used' || input.blastRadius.ownedSharedResources > 0 || input.blastRadius.actionsLast90d > 0) return 'review'
  if (input.dormantAccount) return 'revoke'
  return input.hasDowngrade ? 'downgrade' : 'revoke'
}

export function score(input: { severity: number; sensitivity: number; evidenceStrength: number; staleness: number; weights: { severity: number; sensitivity: number; evidenceStrength: number; staleness: number } }) {
  const total = input.weights.severity + input.weights.sensitivity + input.weights.evidenceStrength + input.weights.staleness
  const normalized = total === 0 ? { severity: 0.25, sensitivity: 0.25, evidenceStrength: 0.25, staleness: 0.25 } : { severity: input.weights.severity / total, sensitivity: input.weights.sensitivity / total, evidenceStrength: input.weights.evidenceStrength / total, staleness: input.weights.staleness / total }
  return Math.round(100 * (normalized.severity * input.severity + normalized.sensitivity * input.sensitivity + normalized.evidenceStrength * input.evidenceStrength + normalized.staleness * input.staleness))
}

export function validateClaims(sentences: { id: string; claims: Claim[] }[], evidence: Evidence[]) {
  const byId = new Map(evidence.map((item) => [item.id, item]))
  const failures: { claimId: string; reason: string }[] = []
  let claims = 0
  let linked = 0
  sentences.forEach((sentence) => sentence.claims.forEach((claim) => { claims += 1; const record = byId.get(claim.evidenceId); const actual = record?.payload[claim.field]; if (!record) failures.push({ claimId: claim.id, reason: 'Evidence record not found.' }); else if (actual !== claim.value) failures.push({ claimId: claim.id, reason: `Expected ${String(claim.value)} but evidence contains ${String(actual)}.` }); else linked += 1 }))
  return { claims, linked, passed: failures.length === 0 && claims > 0, failures }
}

export function canonicalJson(value: unknown) { return JSON.stringify(value, Object.keys(value as object).sort()) }
