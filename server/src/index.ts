import { createApp } from './app.js'
import { env } from './env.js'
import { logger } from './logger.js'
import { MemoryStore } from './store/MemoryStore.js'
import { SupabaseStore } from './store/SupabaseStore.js'

async function main() {
  let store: any

  if (env.STORE === 'supabase') {
    try {
      store = new SupabaseStore()
      await store.getCounts() // Test connection
      logger.info('Using Supabase store')
    } catch (error) {
      if (env.APP_MODE === 'live') {
        logger.error('Supabase unreachable in live mode. Cannot proceed without live persistence.')
        process.exit(1)
      }
      logger.warn('Supabase unreachable, falling back to MemoryStore')
      store = new MemoryStore()
    }
  } else {
    if (env.APP_MODE === 'live' && env.STORE === 'memory') {
      logger.warn('Live mode with STORE=memory: no real persistence. This is for testing only.')
    }
    store = new MemoryStore()
    logger.info('Using MemoryStore')
  }

  const app = createApp(store)

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`)
    logger.info(`Health: http://localhost:${env.PORT}/health`)
  })
}

main().catch((error) => {
  logger.error(error)
  process.exit(1)
})
