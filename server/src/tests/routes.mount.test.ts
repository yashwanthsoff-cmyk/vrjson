import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { MemoryStore } from '../store/MemoryStore.js'

const store = new MemoryStore()
const app = createApp(store)

describe('route mounting', () => {
  for (const p of ['/api/health','/api/snapshots','/api/inventory','/api/grants','/api/schedule','/api/sync-runs','/api/snapshot-coverage']) {
    it(`GET ${p} is mounted`, async () => {
      const r = await request(app).get(p)
      expect(r.status).not.toBe(404)
    })
  }
  it('unknown path returns RFC 7807 404', async () => {
    const r = await request(app).get('/api/nope')
    expect(r.status).toBe(404)
    expect(r.body.status).toBe(404)
  })
})
