import { env } from './env.js'
import { logger } from './logger.js'

export interface GroqCompletionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface GroqExplanationRequest {
  subject: string
  claims: Array<{ id: string; field: string; value: string }>
  showNames: boolean
}

export interface GroqExplanationResponse {
  sentences: Array<{
    template: string
    claimIds: string[]
  }>
}

const BANNED_WORDS = [
  'accuracy',
  'precision',
  'recall',
  'compliant',
  'AI-powered',
  'automatically revokes',
  'seamless',
  'intelligent',
  'innovative',
  'reduces risk by',
]

export async function callGroqExplanation(
  request: GroqExplanationRequest
): Promise<{ sentences: GroqExplanationResponse['sentences']; source: 'model' | 'template'; fallbackUsed: boolean }> {
  if (!env.GROQ_ENABLED) {
    logger.info('Groq disabled, using template fallback')
    return { sentences: [], source: 'template', fallbackUsed: true }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  try {
    const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.1,
        max_completion_tokens: 1500,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You write short access-review summaries. Use ONLY the facts in the provided JSON. Output JSON: {"sentences":[{"template":"... {c1} ... {c2}","claimIds":["c1","c2"]}]}. Every sentence must contain at least one placeholder and reference only provided claim IDs. Do not add numbers, names or dates that are not in the claims. Do not give legal or compliance statements. Do not say anything about accuracy or risk reduction. Maximum 4 sentences.',
          },
          {
            role: 'user',
            content: JSON.stringify(request),
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      // Try again without reasoning_effort and response_format on 400
      if (response.status === 400) {
        logger.warn('Groq 400, retrying without special parameters')
        return await callGroqExplanationSimple(request)
      }

      // Retry once on 429 or 5xx
      if (response.status === 429 || response.status >= 500) {
        logger.warn(`Groq ${response.status}, retrying once`)
        await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second backoff
        return await callGroqExplanation(request)
      }

      logger.error(`Groq error: ${response.status} ${response.statusText}`)
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    const data = await response.json() as GroqCompletionResponse
    const content = data.choices[0]?.message?.content

    if (!content) {
      logger.error('Groq returned empty content')
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    // Parse JSON response
    let parsed: GroqExplanationResponse
    try {
      parsed = JSON.parse(content)
    } catch {
      logger.error('Groq returned invalid JSON')
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    // Log token usage
    if (data.usage) {
      logger.info({
        groqTokens: data.usage.total_tokens,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      })
    }

    return { sentences: parsed.sentences, source: 'model', fallbackUsed: false }
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ error: 'Groq request timed out' })
    } else {
      logger.error({ error: 'Groq request failed', details: error })
    }
    return { sentences: [], source: 'template', fallbackUsed: true }
  }
}

async function callGroqExplanationSimple(
  request: GroqExplanationRequest
): Promise<{ sentences: GroqExplanationResponse['sentences']; source: 'model' | 'template'; fallbackUsed: boolean }> {
  try {
    const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.1,
        max_completion_tokens: 1500,
        messages: [
          {
            role: 'system',
            content: 'You write short access-review summaries. Use ONLY the facts in the provided JSON. Output JSON: {"sentences":[{"template":"... {c1} ... {c2}","claimIds":["c1","c2"]}]}. Every sentence must contain at least one placeholder and reference only provided claim IDs. Do not add numbers, names or dates that are not in the claims. Do not give legal or compliance statements. Do not say anything about accuracy or risk reduction. Maximum 4 sentences.',
          },
          {
            role: 'user',
            content: JSON.stringify(request),
          },
        ],
      }),
    })

    if (!response.ok) {
      logger.error(`Groq simple retry failed: ${response.status}`)
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    const data = await response.json() as GroqCompletionResponse
    const content = data.choices[0]?.message?.content

    if (!content) {
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    // Extract first JSON object from text
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    let parsed: GroqExplanationResponse
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return { sentences: [], source: 'template', fallbackUsed: true }
    }

    return { sentences: parsed.sentences, source: 'model', fallbackUsed: false }
  } catch (error) {
    logger.error({ error: 'Groq simple request failed', details: error })
    return { sentences: [], source: 'template', fallbackUsed: true }
  }
}

export function validateExplanation(
  sentences: GroqExplanationResponse['sentences'],
  claims: Array<{ id: string; field: string; value: string }>
): { valid: boolean; failures: string[] } {
  const failures: string[] = []
  const claimIds = new Set(claims.map((c) => c.id))

  for (const sentence of sentences) {
    // Check for empty claimIds
    if (sentence.claimIds.length === 0) {
      failures.push('Sentence has no claim references')
      continue
    }

    // Check that all referenced claims exist
    for (const claimId of sentence.claimIds) {
      if (!claimIds.has(claimId)) {
        failures.push(`Sentence references non-existent claim: ${claimId}`)
      }
    }

    // Check that template contains no digits (except placeholders)
    const withoutPlaceholders = sentence.template.replace(/\{[^}]+\}/g, '')
    if (/\d/.test(withoutPlaceholders)) {
      failures.push('Template contains digits outside placeholders')
    }

    // Check for banned words
    const lowerTemplate = sentence.template.toLowerCase()
    for (const banned of BANNED_WORDS) {
      if (lowerTemplate.includes(banned)) {
        failures.push(`Template contains banned word: ${banned}`)
      }
    }

    // Check that template has placeholders
    if (!/\{[^}]+\}/.test(sentence.template)) {
      failures.push('Template has no placeholders')
    }
  }

  // Drop zero-claim sentences
  const validSentences = sentences.filter((s) => s.claimIds.length > 0)
  if (validSentences.length > 4) {
    failures.push('More than 4 sentences after filtering')
  }

  return { valid: failures.length === 0, failures }
}
