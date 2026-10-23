import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DataStore } from '../store/DataStore.js'
import { getSessionOverlay } from '../engine-ext/overlay.js'
import { problems } from '../problem.js'

export async function getTagsRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  const entitlementsPage = await store.listEntitlements()
  const entitlementTags: Record<string, string[]> = {}

  for (const ent of entitlementsPage.items) {
    const override = overlay.tags[ent.id]
    entitlementTags[ent.id] = override?.categories ?? ent.categories ?? []
  }

  res.json({
    entitlementTags,
    sessionOverrides: overlay.tags,
  })
}

const putTagSchema = z.object({
  targetType: z.enum(['user', 'entitlement']),
  targetId: z.string().min(1),
  tags: z.array(z.string()).optional(),
  privilegeLevel: z.enum(['admin', 'write', 'read']).optional(),
  dataSensitivity: z.enum(['public', 'internal', 'confidential', 'pii_financial']).optional(),
})

export async function putTagsRoute(store: DataStore, req: Request, res: Response) {
  const parsed = putTagSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid tag payload')
  }

  const { targetType, targetId, tags, privilegeLevel, dataSensitivity } = parsed.data
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  if (targetType === 'entitlement') {
    overlay.tags[targetId] = {
      ...(overlay.tags[targetId] || {}),
      ...(tags ? { categories: tags } : {}),
      ...(privilegeLevel ? { privilegeLevel } : {}),
      ...(dataSensitivity ? { dataSensitivity } : {}),
    }
  }

  res.json({ success: true, targetId, overlay: overlay.tags[targetId] })
}

const deleteTagSchema = z.object({
  targetType: z.enum(['user', 'entitlement']),
  targetId: z.string().min(1),
  tag: z.string().min(1),
})

export async function deleteTagRoute(store: DataStore, req: Request, res: Response) {
  const parsed = deleteTagSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid delete tag payload')
  }

  const { targetType, targetId, tag } = parsed.data
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  if (targetType === 'entitlement' && overlay.tags[targetId]?.categories) {
    overlay.tags[targetId].categories = overlay.tags[targetId].categories!.filter(
      (t) => t !== tag
    )
  }

  res.json({ success: true, targetId, tag })
}
