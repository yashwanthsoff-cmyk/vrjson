import type { App, UsageState } from '@contract'

export const ENTRA_RETENTION_NOTE =
  'Mirrors a 30-day documented retention assumption; usage can be unknown.'

export function getGuardText(state: UsageState, observedDays: number, windowDays: number): string {
  if (state === 'unknown') {
    return `Only ${observedDays} days of logs. Cannot judge.`
  }
  if (state === 'unused') {
    const covered = Math.min(observedDays, windowDays)
    return `Unused: 0 uses in ${covered} of ${windowDays} observed days`
  }
  return 'A mapped event falls inside the active observation window.'
}

export function getCoverageText(observedDays: number, windowDays: number): string {
  const covered = Math.min(observedDays, windowDays)
  return `${covered} of ${windowDays} days observed`
}

export function getBlastRadiusText(
  blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null,
  coverageDays: number
): string | null {
  if (blastRadius === null) {
    return `Not available: only ${coverageDays} days of logs`
  }
  return `${blastRadius.actionsLast90d} actions, ${blastRadius.ownedSharedResources} owned shared resources`
}

export function getAppRetentionNote(app: App): string | null {
  if (app === 'microsoft_entra') {
    return ENTRA_RETENTION_NOTE
  }
  return null
}
