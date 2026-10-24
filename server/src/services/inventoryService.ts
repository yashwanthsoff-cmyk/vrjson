import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import type { Paged } from '../types/extra.js'

export async function getInventory(
  store: DataStore,
  filters: { userId?: string; app?: App; q?: string },
  limit: number,
  offset: number
): Promise<Paged<any>> {
  const [users, entitlements, grants] = await Promise.all([
    store.listUsers(1000, 0),
    store.listEntitlements(1000, 0),
    filters.userId ? store.listGrants({ userId: filters.userId, removed: false }, 1000, 0) : { items: [], total: 0 },
  ])

  const entitlementMap = new Map(entitlements.items.map((e) => [e.id, e]))
  const userMap = new Map(users.items.map((u) => [u.id, u]))

  let rows: any[] = []

  // Build inventory from grants
  for (const grant of grants.items) {
    const user = userMap.get(grant.userId)
    const entitlement = entitlementMap.get(grant.entitlementId)

    if (!user || !entitlement) continue

    rows.push({
      userId: user.id,
      displayName: user.displayName,
      pseudonym: user.pseudonym,
      app: grant.app,
      entitlementId: entitlement.id,
      entitlementName: entitlement.name,
      kind: entitlement.kind,
      privilegeLevel: entitlement.privilegeLevel,
      dataSensitivity: entitlement.dataSensitivity,
      source: grant.source,
    })
  }

  // Apply filters
  if (filters.app) {
    rows = rows.filter((r) => r.app === filters.app)
  }

  if (filters.q) {
    const q = filters.q.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.pseudonym.toLowerCase().includes(q) ||
        r.entitlementName.toLowerCase().includes(q)
    )
  }

  const total = rows.length
  const items = rows.slice(offset, offset + limit)

  return { items, total, limit, offset }
}
