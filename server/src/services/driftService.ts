import type { DataStore } from '../store/DataStore.js'
import { callGroqExplanation, validateExplanation } from '../groq.js'
import { accessAsOf } from '../engine-ext/asof.js'
import { diffSnapshots } from '../engine-ext/diff.js'
import { computePrePost } from '../engine-ext/prepost.js'
import { generateAsofEvidenceId, generateDiffEvidenceId, generateGrantEvidenceId } from '../engine-ext/evidence.js'
import { validateClaims } from '@engine/index.js'
import type { Grant, Snapshot, Evidence, Claim as ContractClaim, ExplanationSentence } from '@contract'
import type { DriftSummary } from '../types/extra.js'
import { logger } from '../logger.js'
import { problems } from '../problem.js'

interface DriftClaim {
  id: string
  field: string
  value: string
}

export async function generateDriftSummary(
  store: DataStore,
  userId: string,
  from: string,
  to: string,
  showNames: boolean,
  actorId: string
): Promise<DriftSummary> {
  // Get user info
  const user = await store.getUserById(userId)
  if (!user) {
    throw problems.notFound('User not found')
  }

  // Get role changes
  const roleChanges = await store.listRoleChanges(userId)
  const roleChange = roleChanges[0] || null

  // Get snapshots
  const allSnapshots = await store.listSnapshots({}, 1000, 0)
  const snapshots = allSnapshots.items

  // Get grants
  const allGrants = await store.listGrants({ userId }, 1000, 0)
  const grants = allGrants.items

  // Compute access-as-of at both dates
  const asOfFrom = accessAsOf(null as any, from.slice(0, 10), snapshots, grants)
  const asOfTo = accessAsOf(null as any, to.slice(0, 10), snapshots, grants)

  // Compute diff
  const diff = diffSnapshots(from.slice(0, 10), to.slice(0, 10), snapshots, grants)

  // Compute pre-post if role change exists
  const prePost = roleChange ? computePrePost(userId, roleChange.changedAt, grants, []) : null

  // Build claims from evidence
  const claims: DriftClaim[] = []
  const evidenceIds: string[] = []
  let claimIndex = 0

  // Access-as-of counts
  claimIndex++
  claims.push({
    id: `c${claimIndex}`,
    field: 'accessAsOfFromCount',
    value: asOfFrom.snapshotUsed?.memberCount?.toString() || '0',
  })
  evidenceIds.push(generateAsofEvidenceId(userId, from.slice(0, 10)))

  claimIndex++
  claims.push({
    id: `c${claimIndex}`,
    field: 'accessAsOfToCount',
    value: asOfTo.snapshotUsed?.memberCount?.toString() || '0',
  })
  evidenceIds.push(generateAsofEvidenceId(userId, to.slice(0, 10)))

  // Diff counts
  claimIndex++
  claims.push({
    id: `c${claimIndex}`,
    field: 'diffAddedCount',
    value: diff.added.length.toString(),
  })
  evidenceIds.push(generateDiffEvidenceId(userId, from.slice(0, 10), to.slice(0, 10)))

  claimIndex++
  claims.push({
    id: `c${claimIndex}`,
    field: 'diffRemovedCount',
    value: diff.removed.length.toString(),
  })
  evidenceIds.push(generateDiffEvidenceId(userId, from.slice(0, 10), to.slice(0, 10)))

  // Role change info
  if (roleChange) {
    claimIndex++
    claims.push({
      id: `c${claimIndex}`,
      field: 'roleChangeDate',
      value: roleChange.changedAt.slice(0, 10),
    })

    claimIndex++
    claims.push({
      id: `c${claimIndex}`,
      field: 'roleChangeFrom',
      value: roleChange.previousDepartment,
    })

    claimIndex++
    claims.push({
      id: `c${claimIndex}`,
      field: 'roleChangeTo',
      value: roleChange.newDepartment,
    })

    if (prePost) {
      claimIndex++
      claims.push({
        id: `c${claimIndex}`,
        field: 'carriedOverCount',
        value: prePost.carriedOverCount.toString(),
      })

      // Up to 3 carried-over permission names
      const carriedOverNames = prePost.before
        .slice(0, 3)
        .map((g) => g.id)
        .join(', ')
      claimIndex++
      claims.push({
        id: `c${claimIndex}`,
        field: 'carriedOverPermissions',
        value: carriedOverNames || 'none',
      })
    }
  }

  // Create derived evidence records
  const derivedEvidence: Evidence[] = []
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]
    derivedEvidence.push({
      id: `ev-claim-${claim.id}`,
      type: 'activity',
      occurredAt: to,
      source: 'drift_summary',
      payload: { claimId: claim.id, field: claim.field, value: claim.value },
      derived: true,
    })
  }

  // Compute scope key for caching
  const scopeKey = await computeScopeKey(userId, from, to, claims)

  // Check cache
  const cached = await store.getDriftSummary(scopeKey)
  if (cached) {
    logger.info('Drift summary cache hit')
    return {
      ...cached.summary,
      cached: true,
    }
  }

  // Call Groq
  const subject = showNames ? user.displayName : user.pseudonym
  const groqResult = await callGroqExplanation({ subject, claims, showNames })

  let sentences: ExplanationSentence[]
  let source: 'model' | 'template'
  let fallbackUsed: boolean

  if (groqResult.source === 'model' && !groqResult.fallbackUsed) {
    // Validate Groq response
    const validation = validateExplanation(groqResult.sentences, claims)
    if (validation.valid) {
      // Convert Groq format to contract format
      sentences = groqResult.sentences.map((s, i) => ({
        id: `sentence-${i}`,
        template: s.template,
        claims: s.claimIds.map((cid) => {
          const claim = claims.find((c) => c.id === cid)
          return {
            id: cid,
            field: claim?.field || '',
            value: claim?.value || '',
            evidenceId: `ev-claim-${cid}`,
          }
        }),
      }))
      source = 'model'
      fallbackUsed = false
    } else {
      logger.warn({ error: 'Groq validation failed, using template fallback', failures: validation.failures })
      sentences = getTemplateSentences()
      source = 'template'
      fallbackUsed = true
    }
  } else {
    sentences = getTemplateSentences()
    source = groqResult.source
    fallbackUsed = groqResult.fallbackUsed
  }

  // Validate claims against evidence
  const validationResult = validateClaims(sentences, derivedEvidence)

  const summary: DriftSummary = {
    id: `ds-${Date.now()}`,
    userId,
    from,
    to,
    source,
    fallbackUsed,
    label: source === 'model'
      ? 'Wording generated by gpt-oss via Groq, validated against evidence. Facts are computed by transparent rules.'
      : 'Fixed template wording.',
    sentences,
    evidence: derivedEvidence,
    validation: validationResult,
    cached: false,
    createdAt: new Date().toISOString(),
  }

  // Cache the result
  await store.setDriftSummary(scopeKey, summary)

  // Audit
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId: actorId || 'system',
    action: 'drift_summary.generated',
    targetType: 'drift_summary',
    targetId: summary.id,
    detail: `Source: ${source}`,
    prevHash: '',
    hash: '',
  })

  return summary
}

async function computeScopeKey(userId: string, from: string, to: string, claims: DriftClaim[]): Promise<string> {
  const data = JSON.stringify({ userId, from, to, claims })
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getTemplateSentences(): ExplanationSentence[] {
  return [
    {
      id: 'template-1',
      template: 'Access changed from {c1} to {c2} between the selected dates.',
      claims: [
        { id: 'c1', field: 'accessAsOfFromCount', value: '0', evidenceId: 'ev-claim-c1' },
        { id: 'c2', field: 'accessAsOfToCount', value: '0', evidenceId: 'ev-claim-c2' },
      ],
    },
    {
      id: 'template-2',
      template: '{c3} permissions were added and {c4} were removed.',
      claims: [
        { id: 'c3', field: 'diffAddedCount', value: '0', evidenceId: 'ev-claim-c3' },
        { id: 'c4', field: 'diffRemovedCount', value: '0', evidenceId: 'ev-claim-c4' },
      ],
    },
  ]
}
