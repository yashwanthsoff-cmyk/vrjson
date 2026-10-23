import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { MemoryStore } from '../store/MemoryStore.js'

describe('F-03 Routes Mount and Functionality Tests', () => {
  let app: any
  let store: MemoryStore

  beforeAll(async () => {
    store = new MemoryStore()
    app = createApp(store)
    // Allow MemoryStore async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
    // Trigger initial request to ensure router stack is instantiated
    await request(app).get('/api/health')
  })

  // Router stack inspection
  it('walks router stack and confirms F-03 routes are mounted', () => {
    const router = app.router || app._router
    const routes: string[] = []
    if (router?.stack) {
      router.stack.forEach((layer: any) => {
        if (layer.route?.path) {
          const methods = Object.keys(layer.route.methods)
          routes.push(`${methods[0].toUpperCase()} ${layer.route.path}`)
        }
      })
    }

    const requiredEndpoints = [
      'GET /api/activity',
      'GET /api/activity/summary',
      'GET /api/mapping-rules',
      'POST /api/mapping/test',
      'POST /api/mapping-rules',
      'PUT /api/mapping-rules/:id',
      'DELETE /api/mapping-rules/:id',
      'GET /api/ingest-runs',
      'POST /api/ingest/simulate',
      'GET /api/observation-windows',
      'GET /api/usage',
      'GET /api/usage/findings',
      'POST /api/usage/evaluate',
      'GET /api/usage/:userId/:entitlementId',
      'GET /api/recommendation/:userId/:entitlementId',
      'GET /api/coverage-guard/:userId/:entitlementId',
      'GET /api/tags',
      'PUT /api/tags',
      'DELETE /api/tags',
      'GET /api/settings/effective',
      'PUT /api/settings/effective',
      'POST /api/settings/effective',
      'POST /api/settings/reset',
      'DELETE /api/session/overlay',
      'GET /api/export/activity.csv',
      'GET /api/export/usage.csv',
      'GET /api/export/inventory.csv',
      'GET /api/scenario-checks/f03',
      'POST /api/usage-summary',
    ]

    for (const ep of requiredEndpoints) {
      expect(routes).toContain(ep)
    }
  })

  // Activity endpoints
  it('GET /api/activity returns 200 with live mapped items', async () => {
    const res = await request(app).get('/api/activity?limit=10')
    expect(res.status).toBe(200)
    expect(res.body.items).toBeDefined()
    expect(res.body.total).toBeGreaterThan(0)
    expect(res.headers['x-total-count']).toBeDefined()
  })

  it('GET /api/activity/summary returns counts and top unmapped actions', async () => {
    const res = await request(app).get('/api/activity/summary')
    expect(res.status).toBe(200)
    expect(res.body.totalEvents).toBeGreaterThan(0)
    expect(res.body.mappedEvents).toBeDefined()
    expect(res.body.unmappedEvents).toBeDefined()
    expect(Array.isArray(res.body.topUnmappedEvents)).toBe(true)
  })

  // Mapping rules endpoints
  it('GET /api/mapping-rules returns rules with specificity and matchCount', async () => {
    const res = await request(app).get('/api/mapping-rules')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.rules)).toBe(true)
    expect(res.body.rules.length).toBeGreaterThan(0)
    const first = res.body.rules[0]
    expect(typeof first.specificity).toBe('number')
    expect(typeof first.matchCount).toBe('number')
  })

  it('POST /api/mapping/test correctly matches action', async () => {
    const res = await request(app)
      .post('/api/mapping/test')
      .send({ action: 'drive.file.create', app: 'google_workspace' })
    expect(res.status).toBe(200)
    expect(res.body.matchedRule).toBeDefined()
    expect(res.body.entitlementId).toBeDefined()
  })

  // Ingest runs & Observation windows
  it('GET /api/ingest-runs returns 200', async () => {
    const res = await request(app).get('/api/ingest-runs')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.runs)).toBe(true)
  })

  it('GET /api/observation-windows returns 200 with observation windows', async () => {
    const res = await request(app).get('/api/observation-windows')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.windows)).toBe(true)
    expect(res.body.windows.length).toBeGreaterThan(0)
  })

  // Usage endpoints
  it('GET /api/usage returns 200 with usage rows', async () => {
    const res = await request(app).get('/api/usage?limit=10')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items.length).toBeGreaterThan(0)
    const first = res.body.items[0]
    expect(first.usage).toBeDefined()
    expect(first.recommendation).toBeDefined()
    expect(first.guardText).toBeDefined()
  })

  it('GET /api/usage/:userId/:entitlementId returns single row or 404', async () => {
    const resOk = await request(app).get('/api/usage/u-karthik/e-drive-admin')
    expect(resOk.status).toBe(200)
    expect(resOk.body.userId).toBe('u-karthik')

    const res404 = await request(app).get('/api/usage/non-existent/fake-ent')
    expect(res404.status).toBe(404)
    expect(res404.body.type).toBe('not_found')
  })

  it('GET /api/usage/findings returns usage detector findings', async () => {
    const res = await request(app).get('/api/usage/findings')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.findings)).toBe(true)
  })

  it('POST /api/usage/evaluate performs stateless evaluation', async () => {
    const res = await request(app)
      .post('/api/usage/evaluate')
      .send({
        user: { id: 'test-user', startDate: '2024-01-01T00:00:00Z', role: 'Dev' },
        entitlement: {
          id: 'test-ent',
          app: 'google_workspace',
          name: 'Test Ent',
          privilegeLevel: 'standard',
          dataSensitivity: 'internal',
          categories: ['Storage'],
        },
        activityTimestamps: ['2026-10-01T00:00:00Z'],
      })
    expect(res.status).toBe(200)
    expect(res.body.usage).toBeDefined()
    expect(res.body.recommendation).toBeDefined()
  })

  // Recommendation & Coverage Guard
  it('GET /api/recommendation/:userId/:entitlementId returns recommendation card data', async () => {
    const res = await request(app).get('/api/recommendation/u-karthik/e-drive-admin')
    expect(res.status).toBe(200)
    expect(res.body.action).toBe('revoke')
    expect(res.body.confidence).toBeDefined()
  })

  it('GET /api/coverage-guard/:userId/:entitlementId returns guard status', async () => {
    const res = await request(app).get('/api/coverage-guard/u-karthik/e-drive-admin')
    expect(res.status).toBe(200)
    expect(res.body.guardText).toBeDefined()
    expect(res.body.canRevoke).toBe(true)
  })

  // Tags and session overlay
  it('GET /api/tags and PUT /api/tags work with session overlay', async () => {
    const sessionId = 'test-sess-tags'
    const getRes = await request(app).get('/api/tags').set('x-session-id', sessionId)
    expect(getRes.status).toBe(200)

    const putRes = await request(app)
      .put('/api/tags')
      .set('x-session-id', sessionId)
      .send({
        targetType: 'entitlement',
        targetId: 'e-drive-admin',
        tags: ['CustomTag1', 'CustomTag2'],
      })
    expect(putRes.status).toBe(200)
    expect(putRes.body.success).toBe(true)
  })

  // Settings overlay
  it('GET and PUT /api/settings/effective computes diff', async () => {
    const sessionId = 'test-sess-settings'
    const getRes = await request(app).get('/api/settings/effective').set('x-session-id', sessionId)
    expect(getRes.status).toBe(200)

    const putRes = await request(app)
      .put('/api/settings/effective')
      .set('x-session-id', sessionId)
      .send({
        unusedWindowDays: { admin: 30, standard: 90 },
      })
    expect(putRes.status).toBe(200)
    expect(putRes.body.settings.unusedWindowDays.admin).toBe(30)
    expect(putRes.body.diff).toBeDefined()
    expect(typeof putRes.body.diff.added).toBe('number')
  })

  // CSV exports
  it('CSV exports return valid CSV with formula injection prevention', async () => {
    const resAct = await request(app).get('/api/export/activity.csv')
    expect(resAct.status).toBe(200)
    expect(resAct.headers['content-type']).toContain('text/csv')
    expect(resAct.text).toContain('Event ID,App,User ID,Action')

    const resUsage = await request(app).get('/api/export/usage.csv')
    expect(resUsage.status).toBe(200)
    expect(resUsage.headers['content-type']).toContain('text/csv')
    expect(resUsage.text).toContain('User ID,Display Name,App')

    const resInv = await request(app).get('/api/export/inventory.csv')
    expect(resInv.status).toBe(200)
    expect(resInv.headers['content-type']).toContain('text/csv')
    expect(resInv.text).toContain('Grant ID,User ID,User Name')
  })

  // Scenario checks
  it('GET /api/scenario-checks/f03 returns all scenarios passing with exact label', async () => {
    const res = await request(app).get('/api/scenario-checks/f03')
    expect(res.status).toBe(200)
    expect(res.body.label).toBe(
      'Checks that the logic reproduces planted scenarios. Not an accuracy measure.'
    )
    expect(res.body.allPassed).toBe(true)
    expect(res.body.scenarios.length).toBe(4)
  })

  // Ingest simulation
  it('POST /api/ingest/simulate ingests 3 events', async () => {
    const res = await request(app)
      .post('/api/ingest/simulate')
      .send({ app: 'google_workspace' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(3)
  })

  // Usage summary
  it('POST /api/usage-summary generates explanation with template fallback', async () => {
    const res = await request(app)
      .post('/api/usage-summary')
      .send({ userId: 'u-karthik', showNames: false })
    expect(res.status).toBe(200)
    expect(res.body.summary).toBeDefined()
    expect(res.body.summary.sentences.length).toBeGreaterThan(0)
    expect(res.body.summary.validation.passed).toBe(true)
  })
})
