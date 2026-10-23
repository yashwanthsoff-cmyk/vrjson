import type { Request, Response } from 'express'
import type { DataStore } from '../store/DataStore.js'
import {
  getSessionOverlay,
  applySettingsOverlay,
  clearSessionOverlay,
} from '../engine-ext/overlay.js'
import { computeConfigDiff } from '../engine-ext/configDiff.js'
import { computeAllUsageRows, BASE_SETTINGS } from '../services/usageEngineService.js'

export async function getEffectiveSettingsRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)
  const effective = applySettingsOverlay(BASE_SETTINGS, overlay.settings)

  res.json(effective)
}

export async function updateEffectiveSettingsRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)

  // Baseline usage rows before changing settings
  const baseRows = await computeAllUsageRows(store, sessionId)
  const baselineFindings = baseRows
    .filter((r) => ['unused', 'stale', 'infrequent'].includes(r.usage.state))
    .map((r) => ({
      userId: r.userId,
      entitlementId: r.entitlementId,
      action: r.recommendation.action,
    }))

  // Update session settings
  overlay.settings = {
    ...(overlay.settings || {}),
    ...req.body,
    unusedWindowDays: {
      ...(overlay.settings?.unusedWindowDays || BASE_SETTINGS.unusedWindowDays),
      ...(req.body.unusedWindowDays || {}),
    },
    weights: {
      ...(overlay.settings?.weights || BASE_SETTINGS.weights),
      ...(req.body.weights || {}),
    },
    detectorsEnabled: {
      ...(overlay.settings?.detectorsEnabled || BASE_SETTINGS.detectorsEnabled),
      ...(req.body.detectorsEnabled || {}),
    },
  }

  const effectiveSettings = applySettingsOverlay(BASE_SETTINGS, overlay.settings)

  // Compute new usage rows with effective settings
  const effRows = await computeAllUsageRows(store, sessionId)
  const effectiveFindings = effRows
    .filter((r) => ['unused', 'stale', 'infrequent'].includes(r.usage.state))
    .map((r) => ({
      userId: r.userId,
      entitlementId: r.entitlementId,
      action: r.recommendation.action,
    }))

  const diff = computeConfigDiff(baselineFindings, effectiveFindings)

  res.json({
    settings: effectiveSettings,
    diff,
  })
}

export async function resetEffectiveSettingsRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  const overlay = getSessionOverlay(sessionId)
  overlay.settings = undefined

  res.json(BASE_SETTINGS)
}

export async function clearOverlayRoute(store: DataStore, req: Request, res: Response) {
  const sessionId = (req as any).sessionId || 'default'
  clearSessionOverlay(sessionId)
  res.json({ success: true, sessionId })
}
