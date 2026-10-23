import pino from 'pino'

const redactKeys = ['authorization', 'apikey', 'password', 'secret', 'token', '*key*']

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: redactKeys,
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
})

export function childLogger(context: Record<string, unknown>) {
  return logger.child(context)
}
