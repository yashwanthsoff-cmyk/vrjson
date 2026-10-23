import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { env } from '../env.js'

const flagsSchema = z.object({
  corruptSnapshotId: z.string().nullable().optional(),
  simulateConnectorError: z.record(z.string(), z.boolean()).optional(),
  simulateShortLogs: z.boolean().optional(),
})

export async function devFlagsRoute(store: DataStore, req: Request, res: Response) {
  if (env.NODE_ENV === 'production') {
    throw problems.forbidden('Dev routes are not available in production')
  }

  const parsed = flagsSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const flags = parsed.data

  if (flags.corruptSnapshotId !== undefined) {
    await store.setDevFlag('corruptSnapshotId', flags.corruptSnapshotId)
  }

  if (flags.simulateConnectorError !== undefined) {
    await store.setDevFlag('simulateConnectorError', flags.simulateConnectorError)
  }

  if (flags.simulateShortLogs !== undefined) {
    await store.setDevFlag('simulateShortLogs', flags.simulateShortLogs)
  }

  // Write audit event
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId: (req as any).actorId || 'system',
    action: 'dev.flags_changed',
    targetType: 'dev_flags',
    targetId: 'global',
    detail: JSON.stringify(flags),
    prevHash: '',
    hash: '',
  })

  res.json({ success: true, flags })
}

export async function devResetRoute(store: DataStore, req: Request, res: Response) {
  if (env.NODE_ENV === 'production') {
    throw problems.forbidden('Dev routes are not available in production')
  }

  // Write surviving audit event first
  await store.insertAudit({
    at: new Date().toISOString(),
    actorId: (req as any).actorId || 'system',
    action: 'dev.reset',
    targetType: 'system',
    targetId: 'reset',
    detail: 'Dev reset initiated',
    prevHash: '',
    hash: '',
  })

  const result = await store.resetSimulated()

  res.json({ success: true, deleted: result.deleted })
}
