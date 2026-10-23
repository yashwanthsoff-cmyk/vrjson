import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DataStore } from '../store/DataStore.js'
import type { App, Evidence, ExplanationSentence } from '@contract'
import type { UsageSummary } from '../types/extra.f03.js'
import { env } from '../env.js'
import { logger } from '../logger.js'
import { computeAllUsageRows } from '../services/usageEngineService.js'
import { explainUsage, validateTemplateString, containsBannedPhrase } from '../engine-ext/usageExplain.js'
import { DEMO_NOW } from '../clock.js'
import { problems } from '../problem.js'

const requestSchema = z.object({
  userId: z.string().min(1),
  app: z.enum(['google_workspace', 'microsoft_entra', 'github']).optional(),
  showNames: z.boolean().default(false),
})

export async function usageSummaryRoute(store: DataStore, req: Request, res: Response) {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) {
    throw problems.badRequest('Invalid usage summary payload')
  }

  const { userId, app, showNames } = parsed.data
  const appFilter = (app as App) || null
  const scopeKey = `${userId}:${appFilter || 'all'}`

  // Check cache first
  const cached = await store.getUsageSummary(scopeKey)
  if (cached) {
    return res.json({
      summary: {
        ...cached,
        cached: true,
      },
    })
  }

  const usersPage = await store.listUsers()
  const user = usersPage.items.find((u) => u.id === userId)
  if (!user) {
    throw problems.notFound(`User ${userId} not found`)
  }

  const subjectName = showNames ? user.displayName : user.pseudonym
  const sessionId = (req as any).sessionId || 'default'

  const allRows = await computeAllUsageRows(store, sessionId)
  const userRows = allRows.filter(
    (r) => r.userId === userId && (!appFilter || r.app === appFilter)
  )

  if (userRows.length === 0) {
    throw problems.notFound(`No usage records found for user ${userId}`)
  }

  // Gather evidence
  const evidenceIds = new Set<string>()
  for (const r of userRows) {
    for (const eid of r.evidenceIds) {
      evidenceIds.add(eid)
    }
  }

  const evidenceList: Evidence[] = []
  for (const eid of evidenceIds) {
    const ev = await store.getEvidenceById(eid)
    if (ev) {
      evidenceList.push(ev)
    }
  }

  // Ensure baseline coverage evidence exists
  if (evidenceList.length === 0) {
    evidenceList.push({
      id: `ev-usage-${userId}-summary`,
      type: 'coverage',
      occurredAt: DEMO_NOW,
      source: 'accessdrift_engine',
      payload: {
        subject: subjectName,
        totalEvaluated: userRows.length,
      },
      derived: true,
    })
  }

  let summary: UsageSummary | null = null

  // Attempt Groq generation if enabled
  if (env.GROQ_ENABLED && env.GROQ_API_KEY) {
    try {
      summary = await callGroqUsageSummary(
        userId,
        appFilter,
        subjectName,
        userRows,
        evidenceList
      )
    } catch (err) {
      logger.warn({ error: err, userId }, 'Groq usage summary failed, falling back to template')
    }
  }

  // Fallback to deterministic template if Groq wasn't used or failed
  if (!summary) {
    summary = explainUsage(userId, appFilter, subjectName, userRows, evidenceList, true)
  }

  // Persist to store cache
  await store.saveUsageSummary(scopeKey, summary)

  res.json({ summary })
}

async function callGroqUsageSummary(
  userId: string,
  app: App | null,
  subjectName: string,
  rows: any[],
  evidenceList: Evidence[]
): Promise<UsageSummary | null> {
  const evidenceMap = new Map(evidenceList.map((e) => [e.id, e]))
  const validClaimIds = new Set<string>()

  // Prompt construction
  const systemPrompt = `You are AccessDrift AI, an access risk detector.
Describe access usage for ${subjectName}.
Return valid JSON adhering to this schema:
{
  "sentences": [
    {
      "id": "sent-1",
      "template": "{c1} holds {c2} permissions evaluated under observation.",
      "claims": [
        { "id": "c1", "field": "subject", "value": "${subjectName}", "evidenceId": "${evidenceList[0].id}" },
        { "id": "c2", "field": "totalEvaluated", "value": ${rows.length}, "evidenceId": "${evidenceList[0].id}" }
      ]
    }
  ]
}
RULES:
1. Templates contain NO digits outside {claimId} placeholders.
2. Every claim must reference an existing evidenceId.
3. Banned phrases: accuracy, precision, recall, compliant, ai-powered, automatically revokes, seamless, intelligent, innovative, reduces risk by.
4. Up to 4 sentences maximum.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarize permissions for user ${userId}.` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data: any = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed.sentences) || parsed.sentences.length === 0) {
      return null
    }

    const sentences: ExplanationSentence[] = []
    for (const sent of parsed.sentences) {
      if (typeof sent.template !== 'string' || !Array.isArray(sent.claims)) {
        return null
      }
      if (containsBannedPhrase(sent.template)) {
        return null
      }

      for (const cl of sent.claims) {
        if (!evidenceMap.has(cl.evidenceId)) {
          return null
        }
        validClaimIds.add(cl.id)
      }

      const val = validateTemplateString(sent.template, validClaimIds)
      if (!val.valid) {
        return null
      }

      sentences.push({
        id: sent.id || `sent-${sentences.length + 1}`,
        template: sent.template,
        claims: sent.claims,
      })
    }

    return {
      id: `usage-sum-${userId}-${app || 'all'}-${Date.now()}`,
      userId,
      app,
      source: 'model',
      fallbackUsed: false,
      label: 'Generated by Groq gpt-oss. Verified against evidence.',
      sentences: sentences.slice(0, 4),
      evidence: evidenceList,
      validation: {
        claims: sentences.reduce((acc, s) => acc + s.claims.length, 0),
        linked: sentences.reduce((acc, s) => acc + s.claims.length, 0),
        passed: true,
        failures: [],
      },
      cached: false,
      createdAt: DEMO_NOW,
    }
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}
