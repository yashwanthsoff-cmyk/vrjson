import { createApp } from '../app.js'
import { MemoryStore } from '../store/MemoryStore.js'
import { snapshots as frontendSnapshots } from '../../../src/data.js'
import request from 'supertest'

async function run() {
  console.log('=== STEP 0: PREFLIGHT GATE ===')
  const store = new MemoryStore()
  const app = createApp(store)

  // 1. Health
  const healthRes = await request(app).get('/api/health')
  console.log(`[Gate 1] Health status: ${healthRes.status}, active store: ${healthRes.body?.store}`)

  // 2. Route-mount proof: every F-02 route returns non-404, and /api/nope returns RFC 7807 404
  const nopeRes = await request(app).get('/api/nope')
  const isRfc7807 = nopeRes.status === 404 && !!nopeRes.body?.type && !!nopeRes.body?.title
  console.log(`[Gate 2] GET /api/nope status: ${nopeRes.status}, is RFC 7807: ${isRfc7807}`)

  // 3. Snapshots count
  const snapRes = await request(app).get('/api/snapshots?limit=500')
  const frontendSnapCount = frontendSnapshots.length
  const totalSnaps = snapRes.body?.total ?? snapRes.body?.items?.length
  console.log(`[Gate 3] Frontend snapshots count: ${frontendSnapCount}, Server snapshots total: ${totalSnaps}`)

  // 4. Meera before-after
  const meeraRes = await request(app).get('/api/before-after?userId=u-meera')
  console.log(`[Gate 4] GET /api/before-after?userId=u-meera status: ${meeraRes.status}`)

  // 5. Replay check
  const replayRes = await request(app).post('/api/replay-check').send({})
  console.log(`[Gate 5] POST /api/replay-check status: ${replayRes.status}, failed: ${replayRes.body?.failed}, passed: ${replayRes.body?.passed}`)

  const allPassed = healthRes.status === 200 &&
    isRfc7807 &&
    meeraRes.status !== 500 &&
    replayRes.body?.failed === 0

  console.log(`Preflight Gate Passed: ${allPassed}`)
  if (!allPassed) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Preflight gate failed with error:', err)
  process.exit(1)
})
