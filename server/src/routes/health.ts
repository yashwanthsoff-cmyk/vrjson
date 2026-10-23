import type { DataStore } from '../store/DataStore.js'
import { problems } from '../problem.js'
import { env } from '../env.js'
import { logger } from '../logger.js'

export async function healthRoute(store: DataStore, req: any, res: any) {
  const counts = await store.getCounts()

  // Mode notice
  const syntheticDataNotice = env.APP_MODE === 'demo'
    ? 'Demo mode: synthetic data. No real people or systems. Nothing here changes any real app.'
    : undefined

  // Try to detect if Supabase is actually reachable
  let supabaseReachable = false
  if (env.STORE === 'supabase') {
    try {
      await store.getCounts()
      supabaseReachable = true
    } catch {
      supabaseReachable = false
    }
  }

  // Check GitHub configuration and authentication
  let githubConfigured = false
  let githubAuthenticated = false
  if (env.GITHUB_TOKEN) {
    githubConfigured = true
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': env.GITHUB_API_VERSION,
        },
        signal: AbortSignal.timeout(5000),
      })
      githubAuthenticated = response.ok
    } catch (error) {
      logger.warn({ error: 'GitHub authentication check failed' })
      githubAuthenticated = false
    }
  }

  // Check Groq configuration and model availability
  let groqConfigured = false
  let modelAvailable = false
  let activeModel = env.GROQ_MODEL
  if (env.GROQ_ENABLED && env.GROQ_API_KEY) {
    groqConfigured = true
    try {
      const response = await fetch(`${env.GROQ_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        const data = await response.json() as { data?: Array<{ id: string }> }
        const models = data.data || []
        const primaryAvailable = models.some((m) => m.id === env.GROQ_MODEL)
        if (primaryAvailable) {
          modelAvailable = true
        } else if (env.GROQ_MODEL_FALLBACK) {
          const fallbackAvailable = models.some((m) => m.id === env.GROQ_MODEL_FALLBACK)
          if (fallbackAvailable) {
            modelAvailable = true
            activeModel = env.GROQ_MODEL_FALLBACK
          }
        }
      }
    } catch (error) {
      logger.warn({ error: 'Groq model check failed' })
    }
  }

  // Determine overall status
  const requiredIntegrationsOk = supabaseReachable || env.STORE === 'memory'
  const status = requiredIntegrationsOk ? 'ok' : 'degraded'

  res.json({
    status,
    mode: env.APP_MODE,
    supabase: {
      reachable: supabaseReachable,
    },
    github: {
      configured: githubConfigured,
      authenticated: githubAuthenticated,
    },
    groq: {
      configured: groqConfigured,
      modelAvailable,
      activeModel,
    },
    counts,
    syntheticDataNotice,
  })
}
