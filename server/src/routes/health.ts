import type { DataStore } from '../store/DataStore.js'
import { problems } from '../problem.js'
import { env } from '../env.js'

export async function healthRoute(store: DataStore, req: any, res: any) {
  const counts = await store.getCounts()

  const syntheticDataNotice = 'Synthetic demo data. No real people or systems. Nothing here changes any real app.'

  res.json({
    status: 'ok',
    store: env.STORE,
    supabaseReachable: env.STORE === 'supabase',
    groqConfigured: env.GROQ_ENABLED,
    counts,
    syntheticDataNotice,
  })
}
