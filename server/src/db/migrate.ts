import { env } from '../env.js'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Client } = pg

async function runMigrations() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const dbDir = __dirname
  const sqlFiles = readdirSync(dbDir)
    .filter((f) => f.endsWith('.sql') && f.match(/^\d+_/))
    .sort()

  const allSql = sqlFiles.map((f) => readFileSync(join(dbDir, f), 'utf-8')).join('\n\n')

  if (env.DATABASE_URL) {
    // Run with pg client
    console.log('Running migrations with DATABASE_URL...')
    const client = new Client({ connectionString: env.DATABASE_URL })

    try {
      await client.connect()
      await client.query('BEGIN')
      await client.query(allSql)
      await client.query('COMMIT')
      console.log('✓ Migrations completed successfully')
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('✗ Migration failed:', error)
      throw error
    } finally {
      await client.end()
    }
  } else {
    // Write all.sql for manual execution
    const allSqlPath = join(dbDir, 'all.sql')
    writeFileSync(allSqlPath, allSql)
    console.log('DATABASE_URL not set.')
    console.log(`Migrations written to: ${allSqlPath}`)
    console.log('Paste this file into the Supabase SQL Editor, run it, then run: npm run db:seed')
    process.exit(0)
  }
}

runMigrations().catch((error) => {
  console.error(error)
  process.exit(1)
})
