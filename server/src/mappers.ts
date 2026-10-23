import type { App } from '@contract'

// Map frontend app names to contract app names
const appMapping: Record<string, App> = {
  'Google Workspace': 'google_workspace',
  'Microsoft Entra': 'microsoft_entra',
  'GitHub': 'github',
}

const reverseAppMapping: Record<App, string> = {
  google_workspace: 'Google Workspace',
  microsoft_entra: 'Microsoft Entra',
  github: 'GitHub',
}

export function mapApp(app: string): App {
  return appMapping[app] || (app as App)
}

export function reverseApp(app: App): string {
  return reverseAppMapping[app]
}
