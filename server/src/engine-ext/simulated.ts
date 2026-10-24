import { DEMO_NOW, addMinutes } from '../clock.js'

let simIndex = 0

/**
 * Rule 10: Simulated time.
 * simulatedAt = DEMO_NOW + 1 minute * simIndex
 */
export function nextSimulatedTime(): string {
  simIndex++
  return addMinutes(DEMO_NOW, simIndex)
}

export function resetSimIndex(): void {
  simIndex = 0
}

export function getCurrentSimIndex(): number {
  return simIndex
}
