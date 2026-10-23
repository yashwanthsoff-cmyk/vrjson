import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DataStore } from '../store/DataStore.js'
import type { App } from '@contract'
import { simulateIngestRun } from '../engine-ext/ingestSim.js'
import { getSessionOverlay, applyRulesOverlay } from '../engine-ext/overlay.js'
import { problems } from '../problem.js'

let isIngesting = false

const bodySchema = z.object({
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).default('google_workspace'),
})

export async function ingestSimulateRoute(store: DataStore, req: Request, res: Response) {
  if (isIngesting) {
    throw problems.conflict('Ingest simulation is currently in progress. Please retry.')
  }

  isIngesting = true
  try {
    const parsed = bodySchema.safeParse(req.body || {})
    if (!parsed.success) {
      throw problems.badRequest('Invalid app parameter for ingest simulation')
    }

    const app = parsed.data.app as App

    // Check dev flags
    const simulateConnectorError = (await store.getDevFlag('simulateConnectorError')) as boolean | null
    if (simulateConnectorError) {
      throw problems.serviceUnavailable('Simulated connector error (503)')
    }

    const sessionId = (req as any).sessionId || 'default'
    const overlay = getSessionOverlay(sessionId)
    const seedRules = await store.listMappingRules()
    const effectiveRules = applyRulesOverlay(seedRules, overlay.rules)

    const previousRuns = await store.listIngestRuns(app)
    const usersPage = await store.listUsers()
    const userMap = new Map(usersPage.items.map((u) => [u.id, u]))
    const entitlementsPage = await store.listEntitlements()
    const entMap = new Map(entitlementsPage.items.map((e) => [e.id, e]))

    const getUserName = (userId: string) => {
      const u = userMap.get(userId)
      return {
        displayName: u?.displayName || userId,
        pseudonym: u?.pseudonym || userId,
      }
    }

    const getEntitlementName = (entitlementId: string) => {
      return entMap.get(entitlementId)?.name || entitlementId
    }

    const result = simulateIngestRun(
      app,
      effectiveRules,
      previousRuns,
      getUserName,
      getEntitlementName
    )

    // Append new activity events and ingest run to store
    await store.insertActivityEvents(result.rawEvents)
    await store.insertIngestRun(result.run)

    res.json({
      success: true,
      count: result.eventsAdded.length,
      simIndex: result.run.ingIndex,
      simulatedAt: result.simulatedAt,
      run: result.run,
      events: result.eventsAdded,
      unmappedNow: result.unmappedNow,
    })
  } catch (err: any) {
    if (err.statusCode === 409 || err.message?.includes('No more sample events')) {
      throw problems.conflict(err.message || 'No more sample events available')
    }
    throw err
  } finally {
    isIngesting = false
  }
}
