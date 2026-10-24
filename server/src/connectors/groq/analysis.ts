import { z } from 'zod'
import { logger } from '../../logger.js'
import { env } from '../../env.js'
import { randomUUID } from 'crypto'

// Required structured output schema for Groq analysis
export const GroqAnalysisSchema = z.object({
  summary: z.string(),
  observedChange: z.string(),
  affectedResource: z.string(),
  beforeAfter: z.string(),
  ruleTriggered: z.string(),
  potentialImpact: z.string(), // Hedged, not definitive
  missingEvidence: z.array(z.string()),
  limitations: z.array(z.string()),
  recommendedNextStep: z.string(),
  reviewerExplanation: z.string(),
  claims: z.array(z.object({
    field: z.string(),
    value: z.string(),
    evidenceId: z.string(),
  })),
})

export type GroqAnalysis = z.infer<typeof GroqAnalysisSchema>

export interface AnalysisRequest {
  findingId: string
  findingVersion: number
  evidenceVersion: string
  findingType: string
  ruleId: string
  beforePermission: string | null
  afterPermission: string | null
  repoFullName: string
  login: string
  timestamps: {
    grantAddedAt: string | null
    grantRemovedAt: string | null
  }
  coverageFlags: {
    hasActivityEvidence: boolean
    coverageDays: number
  }
}

export interface AnalysisResult {
  success: boolean
  analysis: GroqAnalysis | null
  validation: {
    passed: boolean
    failures: string[]
  }
  model: string
  attempts: number
  error?: string
}

const BANNED_CLAIM_FIELDS = [
  'accuracy',
  'precision',
  'compliance',
  'riskReduction',
  'blastRadius',
  'usageCount', // When usage is unknown
]

export async function analyzeFinding(
  request: AnalysisRequest,
  evidenceIds: string[]
): Promise<AnalysisResult> {
  if (!env.GROQ_ENABLED || !env.GROQ_API_KEY) {
    return {
      success: false,
      analysis: null,
      validation: { passed: false, failures: ['Groq not configured'] },
      model: env.GROQ_MODEL,
      attempts: 0,
      error: 'Groq not configured',
    }
  }

  const model = env.GROQ_MODEL
  let attempts = 0
  const maxAttempts = 3

  for (let i = 0; i < maxAttempts; i++) {
    attempts++
    try {
      const analysis = await callGroqAnalysis(request)
      
      // Validate claims
      const validation = validateClaims(analysis.claims, evidenceIds, request.coverageFlags)
      
      if (!validation.passed) {
        logger.warn({ findingId: request.findingId, failures: validation.failures }, 'Claim validation failed, retrying')
        if (i < maxAttempts - 1) {
          continue // Retry
        }
        // Last attempt failed validation
        return {
          success: false,
          analysis,
          validation,
          model,
          attempts,
          error: 'Claim validation failed after retries',
        }
      }

      return {
        success: true,
        analysis,
        validation,
        model,
        attempts,
      }
    } catch (error) {
      logger.error({ findingId: request.findingId, error }, 'Groq analysis request failed')
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1s backoff
        continue
      }
      return {
        success: false,
        analysis: null,
        validation: { passed: false, failures: ['Request failed'] },
        model,
        attempts,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    success: false,
    analysis: null,
    validation: { passed: false, failures: ['Max attempts exceeded'] },
    model,
    attempts,
    error: 'Max attempts exceeded',
  }
}

async function callGroqAnalysis(request: AnalysisRequest): Promise<GroqAnalysis> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

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
            content: `You analyze access drift findings. Output JSON with these fields: summary, observedChange, affectedResource, beforeAfter, ruleTriggered, potentialImpact (hedged with "may" or "likely"), missingEvidence[], limitations[], recommendedNextStep, reviewerExplanation, claims[]. Each claim must have field, value, evidenceId. NEVER claim accuracy, compliance, or risk reduction. When usage is unknown, say so. Do not invent blast radius numbers. Maximum 5 claims.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              findingType: request.findingType,
              ruleId: request.ruleId,
              beforePermission: request.beforePermission,
              afterPermission: request.afterPermission,
              repoFullName: request.repoFullName,
              login: request.login,
              timestamps: request.timestamps,
              coverageFlags: request.coverageFlags,
            }),
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      // Retry without special params on 400
      if (response.status === 400) {
        return await callGroqAnalysisSimple(request)
      }
      throw new Error(`Groq error: ${response.status}`)
    }

    const data = await response.json() as any
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('Empty response from Groq')
    }

    const parsed = JSON.parse(content)
    return GroqAnalysisSchema.parse(parsed)
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

async function callGroqAnalysisSimple(request: AnalysisRequest): Promise<GroqAnalysis> {
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
          content: `You analyze access drift findings. Output JSON with these fields: summary, observedChange, affectedResource, beforeAfter, ruleTriggered, potentialImpact (hedged with "may" or "likely"), missingEvidence[], limitations[], recommendedNextStep, reviewerExplanation, claims[]. Each claim must have field, value, evidenceId. NEVER claim accuracy, compliance, or risk reduction. When usage is unknown, say so. Do not invent blast radius numbers. Maximum 5 claims.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            findingType: request.findingType,
            ruleId: request.ruleId,
            beforePermission: request.beforePermission,
            afterPermission: request.afterPermission,
            repoFullName: request.repoFullName,
            login: request.login,
            timestamps: request.timestamps,
            coverageFlags: request.coverageFlags,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq simple retry failed: ${response.status}`)
  }

  const data = await response.json() as any
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from Groq')
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return GroqAnalysisSchema.parse(parsed)
}

function validateClaims(
  claims: Array<{ field: string; value: string; evidenceId: string }>,
  evidenceIds: string[],
  coverageFlags: { hasActivityEvidence: boolean; coverageDays: number }
): { passed: boolean; failures: string[] } {
  const failures: string[] = []
  const evidenceSet = new Set(evidenceIds)

  for (const claim of claims) {
    // Check evidenceId exists
    if (!evidenceSet.has(claim.evidenceId)) {
      failures.push(`Claim references non-existent evidence: ${claim.evidenceId}`)
    }

    // Check for banned fields
    if (BANNED_CLAIM_FIELDS.includes(claim.field)) {
      failures.push(`Claim uses banned field: ${claim.field}`)
    }

    // Check for usage claims when coverage is insufficient
    if (!coverageFlags.hasActivityEvidence && (claim.field === 'usage' || claim.field === 'lastUsedAt')) {
      failures.push(`Claim references usage but no activity evidence exists`)
    }
  }

  return { passed: failures.length === 0, failures }
}

export function generateCacheKey(
  findingId: string,
  findingVersion: number,
  evidenceVersion: string,
  model: string
): string {
  return `${findingId}:${findingVersion}:${evidenceVersion}:${model}`
}
