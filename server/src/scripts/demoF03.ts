/**
 * server/src/scripts/demoF03.ts
 * Standalone demo script walking through all Feature 3 capabilities.
 * Run with: npm run demo:f03
 */

import { MemoryStore } from '../store/MemoryStore.js'
import { createApp } from '../app.js'
import request from 'supertest'

async function runDemo() {
  console.log('=====================================================')
  console.log('AccessDrift Feature 3 (F-03) Backend Walkthrough Demo')
  console.log('=====================================================\n')

  const store = new MemoryStore()
  const app = createApp(store)
  await new Promise((r) => setTimeout(r, 100))

  // 1. Health & Product Framing
  console.log('1. Health & Synthetic Notice Verification:')
  const healthRes = await request(app).get('/api/health')
  console.log(`   Status: ${healthRes.body.status}`)
  console.log(`   Notice: "${healthRes.body.syntheticDataNotice}"`)
  console.log(`   Store: ${healthRes.body.store}\n`)

  // 2. Scenario Checks (S3, S6, S7, S8)
  console.log('2. Planted Scenario Verification:')
  const scenRes = await request(app).get('/api/scenario-checks/f03')
  console.log(`   Label: "${scenRes.body.label}"`)
  console.log(`   All Passed: ${scenRes.body.allPassed}`)
  for (const sc of scenRes.body.scenarios) {
    console.log(`   - [${sc.pass ? 'PASS' : 'FAIL'}] ${sc.code} (${sc.name}): ${sc.actual}`)
  }
  console.log()

  // 3. Live Mapping Glob Matching
  console.log('3. Live Rule Precedence & Glob Matching:')
  const testMapRes = await request(app)
    .post('/api/mapping/test')
    .send({ action: 'drive.admin.user.delete', app: 'google_workspace' })
  console.log(`   Action: drive.admin.user.delete`)
  console.log(`   Matched Rule ID: ${testMapRes.body.matchedRule?.id}`)
  console.log(`   Entitlement: ${testMapRes.body.entitlementId} (${testMapRes.body.entitlementName})\n`)

  // 4. Ingest Simulation
  console.log('4. Ingest Simulation:')
  const simRes = await request(app)
    .post('/api/ingest/simulate')
    .send({ app: 'google_workspace' })
  console.log(`   Simulation Success: ${simRes.body.success}`)
  console.log(`   Events Ingested: ${simRes.body.count}`)
  console.log(`   Simulation Index: ${simRes.body.simIndex}`)
  console.log(`   Simulated At: ${simRes.body.simulatedAt}\n`)

  // 5. What-If Settings Overlay
  console.log('5. Non-Destructive What-If Settings Overlay:')
  const sessId = 'demo-session-' + Date.now()
  const putSettingsRes = await request(app)
    .put('/api/settings/effective')
    .set('x-session-id', sessId)
    .send({ unusedWindowDays: { admin: 30, standard: 90 } })
  console.log(`   Overlay Admin Window: ${putSettingsRes.body.settings.unusedWindowDays.admin} days`)
  console.log(`   Changed Findings Delta:`, putSettingsRes.body.diff)
  console.log()

  // 6. Coverage Guard Check
  console.log('6. Coverage Guard Defense:')
  const guardRes = await request(app).get('/api/coverage-guard/u-aarav/e-github-write')
  console.log(`   User: u-aarav (Short logs test)`)
  console.log(`   Guard Text: "${guardRes.body.guardText}"`)
  console.log(`   Can Revoke: ${guardRes.body.canRevoke}\n`)

  // 7. AI Usage Summary with Template Fallback
  console.log('7. Explainable Usage Summary:')
  const sumRes = await request(app)
    .post('/api/usage-summary')
    .send({ userId: 'u-karthik', showNames: false })
  console.log(`   Source: ${sumRes.body.summary.source}`)
  console.log(`   Label: "${sumRes.body.summary.label}"`)
  console.log(`   Sentences (${sumRes.body.summary.sentences.length}):`)
  for (const s of sumRes.body.summary.sentences) {
    console.log(`   * ${s.template}`)
  }
  console.log(`   Evidence Verification Passed: ${sumRes.body.summary.validation.passed}\n`)

  // 8. CSV Export Formula Escape Check
  console.log('8. CSV Exports & Formula Injection Safety:')
  const csvRes = await request(app).get('/api/export/usage.csv')
  console.log(`   Content-Type: ${csvRes.headers['content-type']}`)
  console.log(`   CSV Rows: ${csvRes.text.split('\n').length} lines\n`)

  console.log('=====================================================')
  console.log('All Feature 3 demonstrations completed successfully!')
  console.log('=====================================================')
}

runDemo().catch((err) => {
  console.error('Demo failed:', err)
  process.exit(1)
})
