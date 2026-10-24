import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'

const bodySchema = z.object({
  id: z.string().optional(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  detail: z.any(),
})

export async function auditEventRoute(store: DataStore, req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  const { id, actorId, action, targetType, targetId, detail } = parsed.data

  // Idempotency check for finding.viewed
  if (action === 'finding.viewed') {
    const sessionId = (req as any).sessionId
    const existing = await store.listAudit(
      { action, targetType, targetId },
      1,
      0
    )

    // Check if this finding was already viewed in this session
    const alreadyViewed = existing.items.some(
      (ev) => (ev.detail as any)?.sessionId === sessionId
    )

    if (alreadyViewed) {
      return res.json({ recorded: false })
    }

    // Add sessionId to detail
    ;(detail as any).sessionId = sessionId
  }

  // Idempotency by id
  if (id) {
    const existing = await store.listAudit({ action, targetType, targetId }, 1, 0)
    if (existing.items.some((ev) => ev.id === id)) {
      return res.json({ recorded: false })
    }
  }

  await store.insertAudit({
    id,
    at: new Date().toISOString(),
    actorId,
    action,
    targetType,
    targetId,
    detail,
    prevHash: '',
    hash: '',
  } as any)

  res.json({ recorded: true })
}
