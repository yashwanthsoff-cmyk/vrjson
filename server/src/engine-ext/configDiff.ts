export interface ChangedFindings {
  added: number
  removed: number
  actionChanged: number
}

export interface FindingLike {
  userId: string
  entitlementId: string
  action?: string
  recommendation?: { action: string } | string
}

function getAction(f: FindingLike): string {
  if (typeof f.recommendation === 'string') return f.recommendation
  if (f.recommendation && typeof f.recommendation.action === 'string') return f.recommendation.action
  if (f.action) return f.action
  return 'review'
}

/**
 * Computes { added, removed, actionChanged } between baseline finding set and effective finding set.
 * Keyed by (userId, entitlementId).
 */
export function computeConfigDiff(
  baselineFindings: FindingLike[],
  effectiveFindings: FindingLike[]
): ChangedFindings {
  const baseMap = new Map<string, string>()
  for (const f of baselineFindings) {
    const key = `${f.userId}-${f.entitlementId}`
    baseMap.set(key, getAction(f))
  }

  const effMap = new Map<string, string>()
  for (const f of effectiveFindings) {
    const key = `${f.userId}-${f.entitlementId}`
    effMap.set(key, getAction(f))
  }

  let added = 0
  let removed = 0
  let actionChanged = 0

  for (const [key, effAction] of effMap.entries()) {
    if (!baseMap.has(key)) {
      added++
    } else {
      const baseAction = baseMap.get(key)
      if (baseAction !== effAction) {
        actionChanged++
      }
    }
  }

  for (const key of baseMap.keys()) {
    if (!effMap.has(key)) {
      removed++
    }
  }

  return { added, removed, actionChanged }
}
