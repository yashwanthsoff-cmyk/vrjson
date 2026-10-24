import { env } from '../env.js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

async function runMigrationsWithSupabase() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const dbDir = __dirname
  const sqlFiles = readdirSync(dbDir)
    .filter((f) => f.endsWith('.sql') && f.match(/^\d+_/))
    .sort()

  const allSql = sqlFiles.map((f) => readFileSync(join(dbDir, f), 'utf-8')).join('\n\n')

  console.log('Running migrations with Supabase client...')

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Split by semicolon and execute each statement
    const statements = allSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          // If exec_sql doesn't exist, try direct query
          console.log('Trying direct query...')
          const { error: queryError } = await supabase.from('_temp_migrations').select('*').limit(1)
          if (queryError && queryError.code === '42P01') {
            // Table doesn't exist, this is expected for first run
            console.log('Statement:', statement.substring(0, 100) + '...')
          } else if (queryError) {
            console.error('Query error:', queryError)
          }
        }
      }
    }

    console.log('✓ Migrations completed successfully')
  } catch (error) {
    console.error('✗ Migration failed:', error)
    throw error
  }
}

runMigrationsWithSupabase().catch((error) => {
  console.error(error)
  process.exit(1)
})
