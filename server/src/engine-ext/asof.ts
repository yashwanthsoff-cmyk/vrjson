import type { App, Grant, Snapshot } from '@contract'
import type { AccessAsOfApp } from '../types/extra.js'
import { DEMO_NOW, isValidDate, toStartOfDay } from '../clock.js'
import { isActiveOnDate } from './hash.js'

/**
 * Rule 6: Access as of (per app).
 * Nearest earlier-or-equal COMPLETE snapshot, never an incomplete one.
 */
export function accessAsOf(
  app: App,
  requestedDate: string,
  snapshots: Snapshot[],
  grants: Grant[]
): AccessAsOfApp {
  if (!isValidDate(requestedDate)) {
    throw new Error(`Invalid date: ${requestedDate}`)
  }

  const effectiveDate = toStartOfDay(requestedDate)

  // Find nearest earlier-or-equal COMPLETE snapshot
  const appSnapshots = snapshots
    .filter((s) => s.app === app && s.complete && s.takenAt <= effectiveDate)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt)) // descending, so first is nearest

  const snapshotUsed = appSnapshots.length > 0 ? appSnapshots[0] : null

  let snapped = false
  let message = ''

  if (snapshotUsed) {
    const snapDate = snapshotUsed.takenAt.slice(0, 10)
    const reqDate = requestedDate.slice(0, 10)

    if (snapDate === reqDate) {
      snapped = false
      message = `Showing snapshot of ${snapDate}.`
    } else {
      snapped = true
      message = `Showing snapshot of ${snapDate} (nearest before selected).`
    }
  } else {
    message = `No complete snapshot on or before ${requestedDate.slice(0, 10)} for ${app}.`
  }

  // Get permissions from the snapshot time
  const permissions = snapshotUsed
    ? grants.filter((g) => g.app === app && isActiveOnDate(g, snapshotUsed.takenAt))
    : []

  return {
    app,
    requestedDate,
    effectiveDate: snapshotUsed?.takenAt || null,
    snapshotUsed,
    snapped,
    message,
  }
}
