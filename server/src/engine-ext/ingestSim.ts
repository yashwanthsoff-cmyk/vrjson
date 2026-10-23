import type { App, Evidence } from '@contract'
import type { ActivityEvent, ActivityRow, EventMappingRule, IngestRun, IngestSimulateResult } from '../types/extra.f03.js'
import { DEMO_NOW, addMinutes } from '../clock.js'
import { computeLiveMapping } from './mappingLive.js'
import sampleEventsJson from '../seed/sampleIngestEvents.json' with { type: 'json' }

interface SampleEvent {
  app: string
  userId: string
  action: string
  resource: string
  actionClass: 'read' | 'write' | 'export' | 'admin'
}

let ingestIndex = 0
const consumedIndicesPerApp: Record<string, number> = {
  google_workspace: 0,
  microsoft_entra: 0,
  github: 0,
}

export function getIngestIndex(): number {
  return ingestIndex
}

export function incrementIngestIndex(): number {
  ingestIndex++
  return ingestIndex
}

export function resetIngestSimulation(): void {
  ingestIndex = 0
  consumedIndicesPerApp.google_workspace = 0
  consumedIndicesPerApp.microsoft_entra = 0
  consumedIndicesPerApp.github = 0
}

/**
 * Simulates an ingest run for an app:
 * - Increments global ingestIndex
 * - simulatedAt = DEMO_NOW + 1 minute * ingestIndex
 * - Consumes next 3 unused samples for the app (or throws 409 if exhausted)
 * - Returns new IngestRun and ActivityEvents
 */
export function simulateIngestRun(
  app: App,
  effectiveRules: EventMappingRule[],
  previousRuns: IngestRun[],
  getUserName: (userId: string) => { displayName: string; pseudonym: string },
  getEntitlementName: (entitlementId: string) => string
): {
  run: IngestRun
  eventsAdded: ActivityRow[]
  rawEvents: ActivityEvent[]
  unmappedNow: number
  simulatedAt: string
} {
  const samplesForApp = (sampleEventsJson as SampleEvent[]).filter((s) => s.app === app)
  const consumed = consumedIndicesPerApp[app] || 0

  if (consumed >= samplesForApp.length) {
    const error: any = new Error('No more sample events for this app.')
    error.statusCode = 409
    throw error
  }

  const nextSamples = samplesForApp.slice(consumed, consumed + 3)
  consumedIndicesPerApp[app] = consumed + nextSamples.length

  const currentIngIndex = incrementIngestIndex()
  const simulatedAt = addMinutes(DEMO_NOW, currentIngIndex)

  // Previous run's windowTo or DEMO_NOW - 1 day
  const appRuns = previousRuns.filter((r) => r.app === app).sort((a, b) => b.at.localeCompare(a.at))
  const previousWindowTo = appRuns.length > 0 ? appRuns[0].windowTo : DEMO_NOW

  const runId = `ingest-${app}-${currentIngIndex}`
  let eventIdx = 0

  const rawEvents: ActivityEvent[] = nextSamples.map((s) => {
    eventIdx++
    return {
      id: `act-sim-${app}-${currentIngIndex}-${eventIdx}`,
      userId: s.userId,
      app,
      at: simulatedAt,
      action: s.action,
      resource: s.resource,
      actionClass: s.actionClass,
      isSimulated: true,
      ingestRunId: runId,
      createdAt: simulatedAt,
    }
  })

  let unmappedCount = 0
  const eventsAdded: ActivityRow[] = rawEvents.map((ev) => {
    const mapped = computeLiveMapping(ev, effectiveRules)
    if (!mapped.mappedEntitlementId) {
      unmappedCount++
    }
    const names = getUserName(ev.userId)
    return {
      ...ev,
      displayName: names.displayName,
      pseudonym: names.pseudonym,
      mappedEntitlementName: mapped.mappedEntitlementId ? getEntitlementName(mapped.mappedEntitlementId) : null,
      matchedRuleId: mapped.matchedRuleId,
    }
  })

  const run: IngestRun = {
    id: runId,
    app,
    at: simulatedAt,
    windowFrom: previousWindowTo,
    windowTo: simulatedAt,
    eventsPulled: nextSamples.length,
    unmapped: unmappedCount,
    status: 'completed',
    ingIndex: currentIngIndex,
    isSimulated: true,
    createdAt: simulatedAt,
  }

  return {
    run,
    eventsAdded,
    rawEvents,
    unmappedNow: unmappedCount,
    simulatedAt,
  }
}
