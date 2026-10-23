import { env } from './env'

export const DEMO_NOW = env.DEMO_NOW

export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && dateStr <= DEMO_NOW
}

export function parseDate(dateStr: string): Date {
  if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateStr)
  }
  // YYYY-MM-DD means end of that UTC day
  return new Date(`${dateStr}T23:59:59.999Z`)
}

export function toIsoString(date: Date): string {
  return date.toISOString()
}

export function daysBetween(a: string, b: string): number {
  const start = new Date(a).getTime()
  const end = new Date(b).getTime()
  return Math.floor(Math.abs(end - start) / 86_400_000)
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function addMinutes(dateStr: string, minutes: number): string {
  const date = new Date(dateStr)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}
