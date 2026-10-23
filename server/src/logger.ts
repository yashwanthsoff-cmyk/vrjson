import pino from 'pino'

const redactKeys = ['authorization', 'apikey', 'password', 'secret', 'token', '*key*']

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: redactKeys,
  // pino-pretty transport removed - not installed and causes errors
  // Can be added back with: npm install pino-pretty --save-dev
})

export function childLogger(context: Record<string, unknown>) {
  return logger.child(context)
}
