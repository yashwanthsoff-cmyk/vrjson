import type { App, Snapshot } from '@contract'
import type { CoverageCell, SnapshotCoverage } from '../types/extra.js'
import { DEMO_NOW } from '../clock.js'

/**
 * Rule 8: Coverage strip.
 * 52 weekly cells per app (Monday-start UTC weeks, ending with the week containing DEMO_NOW).
 */
export function computeCoverage(app: App, snapshots: Snapshot[]): SnapshotCoverage {
  const demoDate = new Date(DEMO_NOW)
  const cells: CoverageCell[] = []

  // Find the first Monday before or equal to the earliest snapshot
  const appSnapshots = snapshots.filter((s) => s.app === app).sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  if (appSnapshots.length === 0) {
    return { app, cells: [] }
  }

  const firstSnapshot = new Date(appSnapshots[0].takenAt)
  const startOfWeek = getMonday(firstSnapshot)

  // Generate 52 weeks ending with the week containing DEMO_NOW
  const endOfWeek = getMonday(demoDate)

  for (let week = startOfWeek; week <= endOfWeek; week.setDate(week.getDate() + 7)) {
    const weekStart = week.toISOString().slice(0, 10)
    const weekEnd = new Date(week)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setUTCHours(23, 59, 59, 999)

    const weekSnapshots = appSnapshots.filter(
      (s) => {
        const snapDate = new Date(s.takenAt)
        return snapDate >= week && snapDate <= weekEnd
      }
    )

    let status: 'complete' | 'incomplete' | 'gap' = 'gap'
    const snapshotIds: string[] = []

    if (weekSnapshots.length > 0) {
      snapshotIds.push(...weekSnapshots.map((s) => s.id))
      const hasComplete = weekSnapshots.some((s) => s.complete)
      status = hasComplete ? 'complete' : 'incomplete'
    }

    cells.push({
      weekStart,
      status,
      snapshotIds,
    })
  }

  return { app, cells }
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1) // Adjust when Sunday
  d.setUTCDate(diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
