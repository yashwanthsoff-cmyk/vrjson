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
      logger.warn('Supabase unreachable, falling back to MemoryStore')
      store = new MemoryStore()
    }
  } else {
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
