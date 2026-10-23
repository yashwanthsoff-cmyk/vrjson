import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env') })

const { Client } = pg

async function testConnection() {
  console.log('Testing database connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Not set')

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('Connecting (forcing IPv4)...')
    await client.connect()
    console.log('✓ Connected successfully')

    const result = await client.query('SELECT NOW() as now')
    console.log('✓ Query successful:', result.rows[0])

    await client.end()
    console.log('✓ Connection closed')
  } catch (error: any) {
    console.error('✗ Connection failed:', error.message)
    console.error('Error code:', error.code)
    console.error('Error detail:', error.detail || 'No detail')
    await client.end().catch(() => {})
    process.exit(1)
  }
}

testConnection()
