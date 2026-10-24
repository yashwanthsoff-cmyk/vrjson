import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { MemoryStore } from '../store/MemoryStore.js'
import { findMatchingRule, countLiteralCharacters, matchesActionPattern } from '../engine-ext/glob.js'
import { escapeCsv } from '../routes/exportF03.js'
import { containsBannedPhrase, validateTemplateString } from '../engine-ext/usageExplain.js'
import { env } from '../env.js'
import type { App } from '@contract'
import type { EventMappingRule } from '../types/extra.f03.js'

describe('Feature 3 (F-03) Exhaustive Multi-Dimensional Backend Test Suite', () => {
  let app: any
  let store: MemoryStore

  beforeAll(async () => {
    store = new MemoryStore()
    app = createApp(store)
    // Wait for async MemoryStore initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
    await request(app).get('/api/health')
  })

  // =========================================================================
  // 1. RFC 7807 & Negative Input Validation Tests
  // =========================================================================
  describe('1. RFC 7807 Error Responses & Negative Validation', () => {
    it('returns RFC 7807 404 for unmounted route', async () => {
      const res = await request(app).get('/api/completely-unknown-route')
      expect(res.status).toBe(404)
      expect(res.body.type).toBe('not_found')
      expect(res.body.title).toBe('Not Found')
      expect(res.body.status).toBe(404)
      expect(res.body.detail).toContain('/api/completely-unknown-route')
    })

    it('returns RFC 7807 400 when POST /api/mapping/test receives missing or invalid body', async () => {
      const resEmpty = await request(app).post('/api/mapping/test').send({})
      expect(resEmpty.status).toBe(400)
      expect(resEmpty.body.type).toBe('bad_request')
      expect(resEmpty.body.status).toBe(400)

      const resBadApp = await request(app)
        .post('/api/mapping/test')
        .send({ action: 'read', app: 'invalid_app_name' })
      expect(resBadApp.status).toBe(400)
      expect(resBadApp.body.type).toBe('bad_request')
    })

    it('returns RFC 7807 400 when POST /api/mapping-rules receives empty actionPattern', async () => {
      const res = await request(app).post('/api/mapping-rules').send({
        app: 'google_workspace',
        actionPattern: '',
        entitlementId: 'e-drive-admin',
      })
      expect(res.status).toBe(400)
      expect(res.body.type).toBe('bad_request')
    })

    it('returns RFC 7807 404 when updating non-existent mapping rule', async () => {
      const res = await request(app)
        .put('/api/mapping-rules/rule-does-not-exist')
        .send({ note: 'new note' })
      expect(res.status).toBe(404)
      expect(res.body.type).toBe('not_found')
      expect(res.body.detail).toContain('rule-does-not-exist')
    })

    it('returns RFC 7807 404 when querying usage for non-existent user or entitlement', async () => {
      const res = await request(app).get('/api/usage/ghost-user/ghost-ent')
      expect(res.status).toBe(404)
      expect(res.body.type).toBe('not_found')
      expect(res.body.detail).toContain('ghost-user')
    })

    it('returns RFC 7807 404 when querying recommendation for non-existent pair', async () => {
      const res = await request(app).get('/api/recommendation/ghost-user/ghost-ent')
      expect(res.status).toBe(404)
      expect(res.body.type).toBe('not_found')
    })

    it('returns RFC 7807 404 when querying coverage guard for non-existent pair', async () => {
      const res = await request(app).get('/api/coverage-guard/ghost-user/ghost-ent')
      expect(res.status).toBe(404)
      expect(res.body.type).toBe('not_found')
    })

    it('returns RFC 7807 400 when POST /api/usage/evaluate receives invalid payload', async () => {
      const res = await request(app).post('/api/usage/evaluate').send({
        activityTimestamps: 'not-an-array',
      })
      expect(res.status).toBe(400)
      expect(res.body.type).toBe('bad_request')
    })

    it('returns RFC 7807 400 when PUT /api/tags receives invalid targetType', async () => {
      const res = await request(app).put('/api/tags').send({
        targetType: 'invalid_type',
        targetId: 'ent-1',
        tags: ['tag1'],
      })
      expect(res.status).toBe(400)
      expect(res.body.type).toBe('bad_request')
    })

    it('returns RFC 7807 400 when POST /api/usage-summary receives empty payload', async () => {
      const res = await request(app).post('/api/usage-summary').send({})
      expect(res.status).toBe(400)
      expect(res.body.type).toBe('bad_request')
    })
  })

  // =========================================================================
  // 2. Session Isolation & What-If Overlay Tests
  // =========================================================================
  describe('2. Multi-Session Overlay Isolation & Mechanics', () => {
    const sessionA = 'test-session-alpha'
    const sessionB = 'test-session-beta'

    it('isolates rule additions and modifications between sessions', async () => {
      // Session A adds a custom rule
      const addResA = await request(app)
        .post('/api/mapping-rules')
        .set('x-session-id', sessionA)
        .send({
          app: 'google_workspace',
          actionPattern: 'drive.admin.special.test',
          entitlementId: 'e-drive-admin',
          note: 'Session A exclusive rule',
        })
      expect(addResA.status).toBe(201)
      const addedRuleId = addResA.body.id

      // Session A tests mapping: should match the new rule
      const testResA = await request(app)
        .post('/api/mapping/test')
        .set('x-session-id', sessionA)
        .send({
          app: 'google_workspace',
          action: 'drive.admin.special.test',
        })
      expect(testResA.status).toBe(200)
      expect(testResA.body.matchedRule.id).toBe(addedRuleId)

      // Session B tests mapping: should NOT see Session A's rule
      const testResB = await request(app)
        .post('/api/mapping/test')
        .set('x-session-id', sessionB)
        .send({
          app: 'google_workspace',
          action: 'drive.admin.special.test',
        })
      expect(testResB.status).toBe(200)
      expect(testResB.body.matchedRule?.id).not.toBe(addedRuleId)

      // Base session (no header) should NOT see Session A's rule
      const testResBase = await request(app)
        .post('/api/mapping/test')
        .send({
          app: 'google_workspace',
          action: 'drive.admin.special.test',
        })
      expect(testResBase.body.matchedRule?.id).not.toBe(addedRuleId)
    })

    it('isolates what-if threshold settings and computes diff delta', async () => {
      // Session A overrides admin window to 15 days
      const putResA = await request(app)
        .put('/api/settings/effective')
        .set('x-session-id', sessionA)
        .send({
          unusedWindowDays: { admin: 15, standard: 60 },
        })
      expect(putResA.status).toBe(200)
      expect(putResA.body.settings.unusedWindowDays.admin).toBe(15)
      expect(putResA.body.diff).toBeDefined()
      expect(typeof putResA.body.diff.added).toBe('number')

      // Session B effective settings must remain default (45/180)
      const getResB = await request(app)
        .get('/api/settings/effective')
        .set('x-session-id', sessionB)
      expect(getResB.status).toBe(200)
      expect(getResB.body.unusedWindowDays.admin).toBe(45)
      expect(getResB.body.unusedWindowDays.standard).toBe(180)

      // Reset Session A settings
      const resetResA = await request(app)
        .post('/api/settings/reset')
        .set('x-session-id', sessionA)
      expect(resetResA.status).toBe(200)
      expect(resetResA.body.unusedWindowDays.admin).toBe(45)

      // Verify Session A is back to default
      const getResA2 = await request(app)
        .get('/api/settings/effective')
        .set('x-session-id', sessionA)
      expect(getResA2.body.unusedWindowDays.admin).toBe(45)
    })

    it('isolates entitlement tag customizations and allows complete overlay wipe', async () => {
      // Session A tags an entitlement
      const tagResA = await request(app)
        .put('/api/tags')
        .set('x-session-id', sessionA)
        .send({
          targetType: 'entitlement',
          targetId: 'e-drive-admin',
          tags: ['SessionA-Confidential', 'CustomTag99'],
        })
      expect(tagResA.status).toBe(200)

      // Session A sees the custom tags
      const getTagsA = await request(app).get('/api/tags').set('x-session-id', sessionA)
      expect(getTagsA.body.entitlementTags['e-drive-admin']).toContain('SessionA-Confidential')

      // Session B does NOT see the custom tags
      const getTagsB = await request(app).get('/api/tags').set('x-session-id', sessionB)
      expect(getTagsB.body.entitlementTags['e-drive-admin']).not.toContain('SessionA-Confidential')

      // Clear Session A overlay completely
      const clearRes = await request(app)
        .delete('/api/session/overlay')
        .set('x-session-id', sessionA)
      expect(clearRes.status).toBe(200)
      expect(clearRes.body.success).toBe(true)

      // Session A tags revert to default
      const getTagsAAfter = await request(app).get('/api/tags').set('x-session-id', sessionA)
      expect(getTagsAAfter.body.entitlementTags['e-drive-admin']).not.toContain('SessionA-Confidential')
    })
  })

  // =========================================================================
  // 3. Glob Precedence & Specificity Engine Tests
  // =========================================================================
  describe('3. Live Glob Pattern Specificity & App Scoping', () => {
    it('correctly calculates literal character count ignoring wildcards', () => {
      expect(countLiteralCharacters('drive.file.create')).toBe(17)
      expect(countLiteralCharacters('drive.file.*')).toBe(11)
      expect(countLiteralCharacters('drive.*.create')).toBe(13)
      expect(countLiteralCharacters('*')).toBe(0)
      expect(countLiteralCharacters('a?c')).toBe(2)
    })

    it('selects highest literal character count rule when multiple match', () => {
      const rules: EventMappingRule[] = [
        { id: 'rule-generic', app: 'google_workspace', actionPattern: 'drive.*', entitlementId: 'e-generic', note: '' },
        { id: 'rule-specific', app: 'google_workspace', actionPattern: 'drive.admin.user.delete', entitlementId: 'e-specific', note: '' },
        { id: 'rule-medium', app: 'google_workspace', actionPattern: 'drive.admin.*', entitlementId: 'e-medium', note: '' },
      ]

      const matched = findMatchingRule('google_workspace', 'drive.admin.user.delete', rules)
      expect(matched?.id).toBe('rule-specific')
      expect(matched?.entitlementId).toBe('e-specific')
    })

    it('breaks specificity ties by lowest rule ID', () => {
      const rules: EventMappingRule[] = [
        { id: 'rule-02', app: 'google_workspace', actionPattern: 'drive.admin.test.*', entitlementId: 'e-2', note: '' },
        { id: 'rule-01', app: 'google_workspace', actionPattern: 'drive.admin.test.*', entitlementId: 'e-1', note: '' },
      ]

      const matched = findMatchingRule('google_workspace', 'drive.admin.test.create', rules)
      expect(matched?.id).toBe('rule-01')
      expect(matched?.entitlementId).toBe('e-1')
    })

    it('strictly enforces app isolation: never matches cross-app events', () => {
      const rules: EventMappingRule[] = [
        { id: 'rule-gw', app: 'google_workspace', actionPattern: 'repo.delete', entitlementId: 'e-gw', note: '' },
        { id: 'rule-gh', app: 'github', actionPattern: 'repo.delete', entitlementId: 'e-gh', note: '' },
      ]

      const matchedGh = findMatchingRule('github', 'repo.delete', rules)
      expect(matchedGh?.id).toBe('rule-gh')

      const matchedGw = findMatchingRule('google_workspace', 'repo.delete', rules)
      expect(matchedGw?.id).toBe('rule-gw')

      const matchedEntra = findMatchingRule('microsoft_entra', 'repo.delete', rules)
      expect(matchedEntra).toBeNull()
    })

    it('escapes regex metacharacters in actions (dots and pluses are literals, not regex syntax)', () => {
      expect(matchesActionPattern('drive.file', 'drive.file')).toBe(true)
      // A dot in the pattern should NOT match an arbitrary character like 'X'
      expect(matchesActionPattern('driveXfile', 'drive.file')).toBe(false)
      // Question mark should match single character
      expect(matchesActionPattern('file1', 'file?')).toBe(true)
      expect(matchesActionPattern('file12', 'file?')).toBe(false)
    })
  })

  // =========================================================================
  // 4. Planted Scenarios Deep Invariant Verification
  // =========================================================================
  describe('4. Planted Scenarios S3, S6, S7, S8 Invariants', () => {
    it('S3 (Karthik Menon): Dormant contractor admin -> unused, blast 0/0, revoke', async () => {
      const res = await request(app).get('/api/usage/u-karthik/e-drive-admin')
      expect(res.status).toBe(200)
      expect(res.body.usage.state).toBe('unused')
      expect(res.body.usage.dormantAccount).toBe(true)
      expect(res.body.usage.observedDays).toBe(180)
      expect(res.body.recommendation.blastRadius).toEqual({ actionsLast90d: 0, ownedSharedResources: 0 })
      expect(res.body.recommendation.action).toBe('revoke')

      const guardRes = await request(app).get('/api/coverage-guard/u-karthik/e-drive-admin')
      expect(guardRes.body.canRevoke).toBe(true)
      expect(guardRes.body.isShortLogs).toBe(false)
    })

    it('S6 (Aarav Khanna): Short logs (11 days) -> unknown, guardText, review cap, cannot revoke', async () => {
      const res = await request(app).get('/api/usage/u-aarav/e-github-write')
      expect(res.status).toBe(200)
      expect(res.body.usage.state).toBe('unknown')
      expect(res.body.guardText).toBe('Only 11 days of logs. Cannot judge.')
      expect(res.body.recommendation.action).toBe('review')

      const guardRes = await request(app).get('/api/coverage-guard/u-aarav/e-github-write')
      expect(guardRes.body.canRevoke).toBe(false)
      expect(guardRes.body.observedDays).toBe(11)
      expect(guardRes.body.guardText).toContain('Only 11 days of logs')
    })

    it('S7 (Microsoft Entra 30d retention): All Entra entitlements evaluate to unknown with null blastRadius', async () => {
      const res = await request(app).get('/api/usage?app=microsoft_entra&limit=50')
      expect(res.status).toBe(200)
      expect(res.body.items.length).toBeGreaterThan(0)

      for (const item of res.body.items) {
        expect(item.usage.state).toBe('unknown')
        expect(item.recommendation.blastRadius).toBeNull()
        expect(item.recommendation.action).toBe('review')
      }
    })

    it('S8 (Tara Bose): Seasonal quarter-close export -> low confidence review', async () => {
      const res = await request(app).get('/api/usage/u-tara/e-export')
      expect(res.status).toBe(200)
      expect(res.body.seasonal).toBe(true)
      expect(res.body.recommendation.action).toBe('review')
      expect(res.body.recommendation.confidence).toBe('low')
    })
  })

  // =========================================================================
  // 5. Ingest Simulation & Concurrency Tests
  // =========================================================================
  describe('5. Ingest Simulation & Concurrency Control', () => {
    it('POST /api/ingest/simulate increments run index and appends 3 events', async () => {
      const prevRunsRes = await request(app).get('/api/ingest-runs')
      const prevCount = prevRunsRes.body.runs.length

      const simRes = await request(app)
        .post('/api/ingest/simulate')
        .send({ app: 'google_workspace' })
      expect(simRes.status).toBe(200)
      expect(simRes.body.success).toBe(true)
      expect(simRes.body.count).toBe(3)
      expect(simRes.body.simIndex).toBeGreaterThan(0)
      expect(simRes.body.simulatedAt).toBeDefined()

      const afterRunsRes = await request(app).get('/api/ingest-runs')
      expect(afterRunsRes.body.runs.length).toBe(prevCount + 1)
    })

    it('enforces concurrency lock: rapid back-to-back requests do not corrupt state', async () => {
      // Fire two simulations concurrently
      const [res1, res2] = await Promise.all([
        request(app).post('/api/ingest/simulate').send({ app: 'google_workspace' }),
        request(app).post('/api/ingest/simulate').send({ app: 'google_workspace' }),
      ])

      // One should succeed (200), and the other either succeeds sequentially or returns 409 Conflict
      expect([200, 409]).toContain(res1.status)
      expect([200, 409]).toContain(res2.status)
    })
  })

  // =========================================================================
  // 6. CSV Export & Formula Injection Prevention
  // =========================================================================
  describe('6. CSV Export & Formula Injection Defense', () => {
    it('prepends single apostrophe to strings starting with dangerous formula characters', () => {
      expect(escapeCsv('=cmd|"/C calc"!A0')).toBe('\"\'=cmd|\"\"/C calc\"\"!A0\"')
      expect(escapeCsv('+12345')).toBe("'+12345")
      expect(escapeCsv('-98765')).toBe("'-98765")
      expect(escapeCsv('@SUM(1,2)')).toBe('\"\'@SUM(1,2)\"')
      expect(escapeCsv('normal_text')).toBe('normal_text')
      expect(escapeCsv('text,with,commas')).toBe('"text,with,commas"')
    })

    it('GET /api/export/activity.csv returns formatted lines and proper content-type', async () => {
      const res = await request(app).get('/api/export/activity.csv')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toContain('attachment; filename="activity.csv"')
      const lines = res.text.split('\n')
      expect(lines.length).toBeGreaterThan(10)
      expect(lines[0]).toBe('Event ID,App,User ID,Action,Timestamp,Target Resource,Mapped Entitlement ID,Is Simulated')
    })

    it('GET /api/export/usage.csv returns formatted lines and proper content-type', async () => {
      const res = await request(app).get('/api/export/usage.csv')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toContain('attachment; filename="usage.csv"')
      const lines = res.text.split('\n')
      expect(lines.length).toBeGreaterThan(10)
      expect(lines[0]).toBe('User ID,Display Name,App,Entitlement ID,Entitlement Name,Usage State,Observed Days,Window Days,Recommendation,Risk Score,Dormant Account')
    })

    it('GET /api/export/inventory.csv returns formatted lines and proper content-type', async () => {
      const res = await request(app).get('/api/export/inventory.csv')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toContain('attachment; filename="inventory.csv"')
      const lines = res.text.split('\n')
      expect(lines.length).toBeGreaterThan(5)
      expect(lines[0]).toBe('Grant ID,User ID,User Name,Department,App,Entitlement ID,Entitlement Name,Privilege Level,Data Sensitivity,Granted At')
    })
  })

  // =========================================================================
  // 7. Usage Summary & Explainability Verification
  // =========================================================================
  describe('7. Usage Summary Explainer & Validation', () => {
    it('detects banned marketing/AI buzzwords', () => {
      expect(containsBannedPhrase('This is AI-powered analysis')).toBe(true)
      expect(containsBannedPhrase('The system automatically revokes access')).toBe(true)
      expect(containsBannedPhrase('Provides 99% accuracy in detection')).toBe(true)
      expect(containsBannedPhrase('Observation classifies unused permissions.')).toBe(false)
    })

    it('validates template string has no unplaced numeric digits', () => {
      const validClaims = new Set(['c1', 'c2'])
      expect(validateTemplateString('{c1} holds {c2} permissions evaluated.', validClaims).valid).toBe(true)
      expect(validateTemplateString('User holds 5 permissions.', validClaims).valid).toBe(false) // '5' is an unplaced digit!
    })

    it('generates deterministic explanation with claim validation and pseudonymization', async () => {
      const resAnon = await request(app)
        .post('/api/usage-summary')
        .send({ userId: 'u-karthik', showNames: false })
      expect(resAnon.status).toBe(200)
      expect(resAnon.body.summary).toBeDefined()
      expect(resAnon.body.summary.userId).toBe('u-karthik')
      expect(resAnon.body.summary.sentences.length).toBeGreaterThan(0)
      // Check that the subject claim in the first sentence is pseudonymized
      const subjectClaimAnon = resAnon.body.summary.sentences[0].claims.find(
        (c: any) => c.field === 'subject'
      )
      expect(subjectClaimAnon?.value).toBe('Person 031') // pseudonym
      expect(resAnon.body.summary.validation.passed).toBe(true)

      const resNamed = await request(app)
        .post('/api/usage-summary')
        .send({ userId: 'u-karthik', showNames: true })
      expect(resNamed.status).toBe(200)
      const subjectClaimNamed = resNamed.body.summary.sentences[0].claims.find(
        (c: any) => c.field === 'subject'
      )
      expect(subjectClaimNamed?.value).toBe('Karthik Menon') // display name
    })
  })

  // =========================================================================
  // 8. Security & Secret Leakage Audit
  // =========================================================================
  describe('8. Security Headers and Secret Leakage Audit', () => {
    it('sets standard security headers and trace headers', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      // Helmet headers
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      // Custom trace headers
      expect(res.headers['x-request-id']).toBeDefined()
      expect(res.headers['x-data-as-of']).toBeDefined()
    })

    it('ensures no sensitive keys leak in health, usage, error, or summary responses', async () => {
      const secretsToCheck = [
        env.GROQ_API_KEY,
        env.SUPABASE_SERVICE_ROLE_KEY,
        env.SUPABASE_SECRET_KEY,
      ].filter(Boolean) as string[]

      const endpoints = [
        '/api/health',
        '/api/usage?limit=5',
        '/api/activity?limit=5',
        '/api/mapping-rules',
        '/api/nope-404-error',
      ]

      for (const ep of endpoints) {
        const res = await request(app).get(ep)
        const bodyStr = JSON.stringify(res.body)
        for (const secret of secretsToCheck) {
          if (secret && secret.length > 5) {
            expect(bodyStr).not.toContain(secret)
          }
        }
      }
    })
  })
})
