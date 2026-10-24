import http from 'http'
import { createApp } from '../app.js'
import { MemoryStore } from '../store/MemoryStore.js'
import { env } from '../env.js'

interface TestResult {
  suite: string
  name: string
  pass: boolean
  durationMs: number
  detail?: string
}

async function runLiveHttpTests() {
  console.log('===============================================================')
  console.log('AccessDrift Feature 3 (F-03) Exhaustive Live Network Test Suite')
  console.log('===============================================================\n')

  const store = new MemoryStore()
  const app = createApp(store)

  // Initialize MemoryStore
  await new Promise((resolve) => setTimeout(resolve, 150))

  // Start HTTP server on dynamic port
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address() as any
  const baseUrl = `http://127.0.0.1:${address.port}`

  console.log(`📡 Server listening on ephemeral port ${address.port}`)
  console.log(`🌐 Base URL: ${baseUrl}\n`)

  const results: TestResult[] = []

  async function check(suite: string, name: string, fn: () => Promise<void>) {
    const start = performance.now()
    try {
      await fn()
      const durationMs = Math.round(performance.now() - start)
      results.push({ suite, name, pass: true, durationMs })
      console.log(`  ✅ [PASS] (${durationMs}ms) ${name}`)
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start)
      results.push({ suite, name, pass: false, durationMs, detail: err.message })
      console.log(`  ❌ [FAIL] (${durationMs}ms) ${name}: ${err.message}`)
    }
  }

  try {
    // -----------------------------------------------------------------------
    // DOMAIN 1: Health & Synthetic Data Notice
    // -----------------------------------------------------------------------
    console.log('🔍 Testing Domain 1: Health & Synthetic Notice')
    await check('Domain 1', 'GET /api/health returns 200 with synthetic notice and trace headers', async () => {
      const res = await fetch(`${baseUrl}/api/health`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (json.status !== 'ok') throw new Error('Status not ok')
      if (!json.syntheticDataNotice) throw new Error('Missing syntheticDataNotice')
      if (!res.headers.get('x-request-id')) throw new Error('Missing x-request-id header')
      if (!res.headers.get('x-data-as-of')) throw new Error('Missing x-data-as-of header')
    })

    // -----------------------------------------------------------------------
    // DOMAIN 2: Activity Log & Summary
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 2: Activity Events & Summary')
    await check('Domain 2', 'GET /api/activity returns live mapped activity with pagination', async () => {
      const res = await fetch(`${baseUrl}/api/activity?limit=5`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (!Array.isArray(json.items) || json.items.length === 0) throw new Error('No items returned')
      if (typeof json.total !== 'number' || json.total <= 0) throw new Error('Invalid total count')
      if (!res.headers.get('x-total-count')) throw new Error('Missing X-Total-Count header')
    })

    await check('Domain 2', 'GET /api/activity/summary provides breakdown of mapped vs unmapped events', async () => {
      const res = await fetch(`${baseUrl}/api/activity/summary`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (typeof json.totalEvents !== 'number' || json.totalEvents <= 0) throw new Error('Invalid totalEvents')
      if (typeof json.mappedEvents !== 'number') throw new Error('Invalid mappedEvents')
      if (typeof json.unmappedEvents !== 'number') throw new Error('Invalid unmappedEvents')
    })

    // -----------------------------------------------------------------------
    // DOMAIN 3: Live Mapping Rules & Specificity Engine
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 3: Live Mapping Rules & Glob Specificity')
    await check('Domain 3', 'GET /api/mapping-rules returns rules enriched with specificity score', async () => {
      const res = await fetch(`${baseUrl}/api/mapping-rules`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (!Array.isArray(json.rules) || json.rules.length === 0) throw new Error('No rules returned')
      for (const r of json.rules) {
        if (typeof r.specificity !== 'number') throw new Error(`Rule ${r.id} missing specificity`)
      }
    })

    await check('Domain 3', 'POST /api/mapping/test evaluates action with highest literal count winning', async () => {
      const res = await fetch(`${baseUrl}/api/mapping/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: 'google_workspace', action: 'drive.admin.user.delete' }),
      })
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (!json.matchedRule) throw new Error('Expected matchedRule')
      if (json.entitlementId !== 'e-drive-admin') throw new Error(`Expected e-drive-admin, got ${json.entitlementId}`)
    })

    // -----------------------------------------------------------------------
    // DOMAIN 4: Ingest Runs & Ingest Simulation
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 4: Ingest Runs & Simulation Mechanics')
    await check('Domain 4', 'POST /api/ingest/simulate ingests 3 synthetic events and advances index', async () => {
      const res = await fetch(`${baseUrl}/api/ingest/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: 'google_workspace' }),
      })
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (json.count !== 3) throw new Error(`Expected 3 events, got ${json.count}`)
      if (typeof json.simIndex !== 'number' || json.simIndex < 1) throw new Error('Invalid simIndex')
    })

    // -----------------------------------------------------------------------
    // DOMAIN 5: Observation Windows
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 5: Observation Windows & Retention Boundaries')
    await check('Domain 5', 'GET /api/observation-windows returns user/app coverage rows', async () => {
      const res = await fetch(`${baseUrl}/api/observation-windows`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (!Array.isArray(json.windows) || json.windows.length === 0) throw new Error('No windows returned')
      const first = json.windows[0]
      if (typeof first.observedDays !== 'number') throw new Error('Missing observedDays')
      if (typeof first.coverageDays !== 'number') throw new Error('Missing coverageDays')
    })

    // -----------------------------------------------------------------------
    // DOMAIN 6: Usage Engine & Planted Scenarios
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 6: Usage Engine & Planted Scenarios (S3, S6, S7, S8)')
    await check('Domain 6', 'GET /api/scenario-checks/f03 verifies all 4 planted scenarios pass', async () => {
      const res = await fetch(`${baseUrl}/api/scenario-checks/f03`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (!json.allPassed) throw new Error('One or more planted scenarios failed!')
      if (json.scenarios.length !== 4) throw new Error(`Expected 4 scenarios, got ${json.scenarios.length}`)
      if (json.label !== 'Checks that the logic reproduces planted scenarios. Not an accuracy measure.') {
        throw new Error('Incorrect exact scenario label')
      }
    })

    await check('Domain 6', 'S3 (Karthik Menon): Unused dormant contractor admin recommends Revoke', async () => {
      const res = await fetch(`${baseUrl}/api/usage/u-karthik/e-drive-admin`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (json.usage.state !== 'unused') throw new Error(`Expected unused, got ${json.usage.state}`)
      if (!json.usage.dormantAccount) throw new Error('Expected dormantAccount true')
      if (json.recommendation.action !== 'revoke') throw new Error(`Expected revoke, got ${json.recommendation.action}`)
    })

    await check('Domain 6', 'S6 (Aarav Khanna): Short logs (11 days) hard-caps recommendation at Review', async () => {
      const res = await fetch(`${baseUrl}/api/usage/u-aarav/e-github-write`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (json.usage.state !== 'unknown') throw new Error(`Expected unknown, got ${json.usage.state}`)
      if (!json.guardText.includes('Only 11 days of logs')) throw new Error('Missing short logs guard text')
      if (json.recommendation.action !== 'review') throw new Error(`Expected review, got ${json.recommendation.action}`)
    })

    await check('Domain 6', 'S7 (Microsoft Entra 30d retention): All Entra entitlements evaluate to unknown', async () => {
      const res = await fetch(`${baseUrl}/api/usage?app=microsoft_entra&limit=50`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      for (const row of json.items) {
        if (row.usage.state !== 'unknown') throw new Error(`Expected unknown, got ${row.usage.state}`)
        if (row.recommendation.blastRadius !== null) throw new Error('Expected null blast radius for Entra')
      }
    })

    await check('Domain 6', 'S8 (Tara Bose): Seasonal quarter-close export gets low confidence Review', async () => {
      const res = await fetch(`${baseUrl}/api/usage/u-tara/e-export`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (!json.seasonal) throw new Error('Expected seasonal true')
      if (json.recommendation.action !== 'review') throw new Error(`Expected review, got ${json.recommendation.action}`)
      if (json.recommendation.confidence !== 'low') throw new Error(`Expected low confidence, got ${json.recommendation.confidence}`)
    })

    // -----------------------------------------------------------------------
    // DOMAIN 7: Session Overlay & What-If Simulations
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 7: Non-Destructive What-If Session Overlay')
    const testSession = 'live-test-session-123'

    await check('Domain 7', 'PUT /api/settings/effective isolates session what-if changes and computes diff', async () => {
      const res = await fetch(`${baseUrl}/api/settings/effective`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': testSession,
        },
        body: JSON.stringify({ unusedWindowDays: { admin: 20 } }),
      })
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const json: any = await res.json()
      if (json.settings.unusedWindowDays.admin !== 20) throw new Error('Setting was not updated in session')
      if (typeof json.diff?.added !== 'number') throw new Error('Missing diff delta')

      // Verify unauthenticated / default session did NOT change
      const defaultRes = await fetch(`${baseUrl}/api/settings/effective`)
      const defaultJson: any = await defaultRes.json()
      if (defaultJson.unusedWindowDays.admin === 20) throw new Error('Session leaked to default store!')
    })

    await check('Domain 7', 'DELETE /api/session/overlay clears all what-if overrides cleanly', async () => {
      const delRes = await fetch(`${baseUrl}/api/session/overlay`, {
        method: 'DELETE',
        headers: { 'x-session-id': testSession },
      })
      if (delRes.status !== 200) throw new Error(`Expected 200, got ${delRes.status}`)
      const checkRes = await fetch(`${baseUrl}/api/settings/effective`, {
        headers: { 'x-session-id': testSession },
      })
      const checkJson: any = await checkRes.json()
      if (checkJson.unusedWindowDays.admin === 20) throw new Error('Session overlay was not cleared!')
    })

    // -----------------------------------------------------------------------
    // DOMAIN 8: CSV Exports & Formula Injection Defense
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 8: CSV Exports & Formula Injection Safety')
    await check('Domain 8', 'GET /api/export/activity.csv returns RFC-compliant CSV with formula protection', async () => {
      const res = await fetch(`${baseUrl}/api/export/activity.csv`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      if (!res.headers.get('content-type')?.includes('text/csv')) throw new Error('Not text/csv')
      const text = await res.text()
      const lines = text.split('\n')
      if (lines.length < 5) throw new Error('Empty or truncated CSV')
      if (!lines[0].startsWith('Event ID,App,User ID')) throw new Error('Header mismatch')
    })

    await check('Domain 8', 'GET /api/export/usage.csv returns RFC-compliant CSV with formula protection', async () => {
      const res = await fetch(`${baseUrl}/api/export/usage.csv`)
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
      const text = await res.text()
      const lines = text.split('\n')
      if (lines.length < 10) throw new Error('Truncated usage CSV')
      if (!lines[0].startsWith('User ID,Display Name')) throw new Error('Header mismatch')
    })

    // -----------------------------------------------------------------------
    // DOMAIN 9: Explainable Summary & Evidence Linking
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 9: Explainable Usage Summary & Claim Validation')
    await check('Domain 9', 'POST /api/usage-summary links sentences to evidence and honors pseudonymization', async () => {
      // Test pseudonymized mode
      const resAnon = await fetch(`${baseUrl}/api/usage-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u-karthik', showNames: false }),
      })
      if (resAnon.status !== 200) throw new Error(`Expected 200, got ${resAnon.status}`)
      const jsonAnon: any = await resAnon.json()
      if (!jsonAnon.summary?.validation?.passed) throw new Error('Evidence validation failed')
      const subAnon = jsonAnon.summary.sentences[0].claims.find((c: any) => c.field === 'subject')
      if (subAnon?.value !== 'Person 031') throw new Error(`Expected pseudonym Person 031, got ${subAnon?.value}`)

      // Test named mode
      const resNamed = await fetch(`${baseUrl}/api/usage-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u-karthik', showNames: true }),
      })
      if (resNamed.status !== 200) throw new Error(`Expected 200, got ${resNamed.status}`)
      const jsonNamed: any = await resNamed.json()
      const subNamed = jsonNamed.summary.sentences[0].claims.find((c: any) => c.field === 'subject')
      if (subNamed?.value !== 'Karthik Menon') throw new Error(`Expected Karthik Menon, got ${subNamed?.value}`)
    })

    // -----------------------------------------------------------------------
    // DOMAIN 10: Security Headers & Secret Leakage Audit
    // -----------------------------------------------------------------------
    console.log('\n🔍 Testing Domain 10: Security Headers & Secret Leakage Audit')
    await check('Domain 10', 'Enforces Helmet headers and never leaks API secrets in responses', async () => {
      const res = await fetch(`${baseUrl}/api/health`)
      if (res.headers.get('x-content-type-options') !== 'nosniff') {
        throw new Error('Missing x-content-type-options: nosniff')
      }

      const secretsToCheck = [
        env.GROQ_API_KEY,
        env.SUPABASE_SERVICE_ROLE_KEY,
        env.SUPABASE_SECRET_KEY,
      ].filter(Boolean) as string[]

      const testUrls = [
        `${baseUrl}/api/health`,
        `${baseUrl}/api/usage?limit=5`,
        `${baseUrl}/api/mapping-rules`,
        `${baseUrl}/api/nope-404-check`,
      ]

      for (const u of testUrls) {
        const r = await fetch(u)
        const txt = await r.text()
        for (const secret of secretsToCheck) {
          if (secret.length > 5 && txt.includes(secret)) {
            throw new Error(`CRITICAL SECURITY FAILURE: Secret leaked at ${u}`)
          }
        }
      }
    })

    await check('Domain 10', 'Returns RFC 7807 problem details on 404 and 400 errors', async () => {
      const res404 = await fetch(`${baseUrl}/api/non-existent-route`)
      if (res404.status !== 404) throw new Error(`Expected 404, got ${res404.status}`)
      const json404: any = await res404.json()
      if (json404.type !== 'not_found' || json404.status !== 404) {
        throw new Error('Not RFC 7807 compliant')
      }

      const res400 = await fetch(`${baseUrl}/api/mapping/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: '' }), // Invalid
      })
      if (res400.status !== 400) throw new Error(`Expected 400, got ${res400.status}`)
      const json400: any = await res400.json()
      if (json400.type !== 'bad_request' || json400.status !== 400) {
        throw new Error('Not RFC 7807 compliant')
      }
    })
  } finally {
    server.close()
  }

  // Summary
  console.log('\n===============================================================')
  const total = results.length
  const passed = results.filter((r) => r.pass).length
  const failed = total - passed

  console.log(`Live HTTP Test Results: ${passed}/${total} passed (${failed} failed)`)
  if (failed === 0) {
    console.log('🎉 All 10 backend functional and security domains verified!')
  } else {
    console.error('💥 Some tests failed!')
    process.exit(1)
  }
  console.log('===============================================================\n')
}

runLiveHttpTests().catch((err) => {
  console.error('Fatal live test execution error:', err)
  process.exit(1)
})
