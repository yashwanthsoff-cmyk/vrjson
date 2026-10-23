import type { DataStore } from '../store/DataStore.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { problems } from '../problem.js'
import { settings as frontendSettings } from '../../../src/data.js'

export async function settingsRoute(store: DataStore, req: Request, res: Response) {
  // For now, return static settings from frontend
  // TODO: In Phase 4, this should be persisted in the store
  res.json(frontendSettings)
}

export async function updateSettingsRoute(store: DataStore, req: Request, res: Response) {
  const bodySchema = z.object({
    adminWindowDays: z.number().optional(),
    standardWindowDays: z.number().optional(),
    peerThresholdPct: z.number().optional(),
    minPeerCount: z.number().optional(),
    graceDays: z.number().optional(),
    staleGrantDays: z.number().optional(),
    staleReviewDays: z.number().optional(),
    mode: z.enum(['department_title', 'title_only']).optional(),
    coverageMinDays: z.number().optional(),
  })

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid request body')
  }

  // For now, just return the merged settings
  // TODO: In Phase 4, persist in store and log audit event
  const updatedSettings = { ...frontendSettings, ...parsed.data }

  res.json(updatedSettings)
}
