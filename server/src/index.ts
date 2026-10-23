import { createApp } from './app.js'
import { env, isLive, isDemo } from './env.js'
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
      if (isLive) {
        logger.error('Supabase unreachable in live mode. Cannot proceed without live persistence.')
        process.exit(1)
      }
      logger.warn('Supabase unreachable, falling back to MemoryStore')
      store = new MemoryStore()
    }
  } else {
    // STORE=memory is only allowed in demo mode
    if (isLive) {
      logger.error('STORE=memory is not allowed in live mode. Set STORE=supabase')
      process.exit(1)
    }
    store = new MemoryStore()
    logger.info('Using MemoryStore (demo mode)')
  }

  const app = createApp(store)

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`)
    logger.info(`Health: http://localhost:${env.PORT}/health`)
    if (isDemo) {
      logger.info('Demo mode: using synthetic data')
    } else if (isLive) {
      logger.info('Live mode: connected to real data sources')
    }
  })
}

main().catch((error) => {
  logger.error(error)
  process.exit(1)
})
