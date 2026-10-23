import type { DataStore } from '../store/DataStore.js'
import { problems } from '../problem.js'
import { env } from '../env.js'

export async function healthRoute(store: DataStore, req: any, res: any) {
  const counts = await store.getCounts()

  const syntheticDataNotice = 'Synthetic demo data. No real people or systems. Nothing here changes any real app.'

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

  res.json({
    status: 'ok',
    store: env.STORE,
    supabaseReachable,
    groqConfigured: env.GROQ_ENABLED,
    counts,
    syntheticDataNotice,
  })
}
