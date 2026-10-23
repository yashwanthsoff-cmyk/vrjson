import dotenv from 'dotenv'
import { z } from 'zod'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

const envSchema = z.object({
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_VERSION: z.string().default('2022-11-28'),
  GITHUB_ORG: z.string().optional(),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  GROQ_MODEL_FALLBACK: z.string().default('openai/gpt-oss-20b'),
  GROQ_BASE_URL: z.string().url(),
  GROQ_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().optional(),
  STORE: z.enum(['supabase', 'postgres', 'memory']).default('memory'),
  PORT: z.coerce.number().default(8787),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_MODE: z.enum(['live', 'demo']).default('demo'),
  DEMO_NOW: z.string().datetime(),
  SESSION_OVERLAY_TTL_MIN: z.coerce.number().default(120),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

let parsed: z.infer<typeof envSchema>

try {
  parsed = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    // In test mode, use defaults instead of exiting
    if (process.env.NODE_ENV === 'test') {
      console.warn('Environment validation failed in test mode, using defaults')
      parsed = envSchema.parse({
        GITHUB_TOKEN: 'test-key',
        GITHUB_API_VERSION: '2022-11-28',
        GROQ_API_KEY: 'test-key',
        GROQ_MODEL: 'openai/gpt-oss-120b',
        GROQ_MODEL_FALLBACK: 'openai/gpt-oss-20b',
        GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
        GROQ_ENABLED: 'true',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        SUPABASE_ANON_KEY: 'test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        STORE: 'memory',
        PORT: '8787',
        CORS_ORIGIN: 'http://localhost:5173',
        APP_MODE: 'demo',
        DEMO_NOW: '2026-10-23T00:00:00Z',
        SESSION_OVERLAY_TTL_MIN: 120,
        NODE_ENV: 'test',
      })
    } else {
      console.error('Environment validation failed:')
      const zodError = error as z.ZodError<any>
      zodError.issues.forEach((err: any) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`)
      })
      process.exit(1)
    }
  } else {
    throw error
  }
}

export const env = parsed

export const isDev = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'
