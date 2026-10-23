import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { getDiff } from '../services/accessService.js'

const querySchema = z.object({
  userId: z.string().min(1),
  a: z.string().min(1),
  b: z.string().min(1),
})

export async function exportDiffCsvRoute(store: DataStore, req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    throw problems.badRequest('Invalid query parameters')
  }

  const { userId, a, b } = parsed.data

  const result = await getDiff(store, userId, a, b)

  // Build CSV
  const headers = ['Grant ID', 'User ID', 'Entitlement ID', 'App', 'Status', 'Granted At', 'Removed At']
  const rows = []

  for (const grant of result.added) {
    rows.push([
      escapeCsv(grant.id),
      escapeCsv(grant.userId),
      escapeCsv(grant.entitlementId),
      escapeCsv(grant.app),
      'Added',
      escapeCsv(grant.grantedAt),
      escapeCsv(grant.removedAt || ''),
    ])
  }

  for (const grant of result.removed) {
    rows.push([
      escapeCsv(grant.id),
      escapeCsv(grant.userId),
      escapeCsv(grant.entitlementId),
      escapeCsv(grant.app),
      'Removed',
      escapeCsv(grant.grantedAt),
      escapeCsv(grant.removedAt || ''),
    ])
  }

  for (const grant of result.unchanged) {
    rows.push([
      escapeCsv(grant.id),
      escapeCsv(grant.userId),
      escapeCsv(grant.entitlementId),
      escapeCsv(grant.app),
      'Unchanged',
      escapeCsv(grant.grantedAt),
      escapeCsv(grant.removedAt || ''),
    ])
  }

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  // Write audit event
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId: (req as any).actorId || 'system',
    action: 'export.created',
    targetType: 'diff',
    targetId: `${userId}-${a}-${b}`,
    detail: `Diff export for user ${userId} between ${a} and ${b}`,
  })

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="diff-${userId}-${a}-${b}.csv"`)
  res.send(csv)
}

function escapeCsv(value: string): string {
  if (!value) return ''
  const str = String(value)
  // Escape cells starting with formula characters
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`
  }
  // Escape cells containing commas, quotes, or newlines
  if (/[,"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
