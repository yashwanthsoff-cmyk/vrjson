import { env } from '../env.js'
import { createClient } from '@supabase/supabase-js'
import { users, entitlements, snapshots as frontendSnapshots, roleChanges as frontendRoleChanges, findings, evidence as frontendEvidence } from '../../src/data.js'
import { computeContentHash, computeMemberCount } from '../engine-ext/hash.js'
import { mapApp } from '../store/MemoryStore.js'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Track snapshots whose hash was recomputed
const recomputedHashes: string[] = []

async function seedUsers() {
  console.log('Seeding users...')
  for (const user of users) {
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      display_name: user.name,
      pseudonym: user.pseudonym,
      department: user.department,
      title: user.title,
      manager_id: user.manager || null,
      employment_type: user.employmentType,
      start_date: user.startDate,
      seniority: user.seniority,
    }, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${users.length} users`)
}

async function seedEntitlements() {
  console.log('Seeding entitlements...')
  for (const ent of entitlements) {
    const { error } = await supabase.from('entitlements').upsert({
      id: ent.id,
      app: mapApp(ent.app),
      name: ent.name,
      kind: ent.kind,
      privilege_level: ent.level,
      data_sensitivity: ent.sensitivity === 'admin' ? 'pii_financial' : ent.sensitivity === 'high' ? 'confidential' : ent.sensitivity === 'medium' ? 'internal' : 'public',
      categories: ent.categories,
      seasonal: ent.seasonal,
      downgrade_to_id: ent.downgradeTo,
      version: 1,
    }, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${entitlements.length} entitlements`)
}

async function seedReviewers() {
  console.log('Seeding reviewers...')
  const reviewers = [
    { id: 'rev-asha', display_name: 'Asha Rao', pseudonym: 'Person 001', department: 'Support', is_active: true },
    { id: 'rev-vikram', display_name: 'Vikram Shah', pseudonym: 'Person 002', department: 'Finance', is_active: true },
    { id: 'rev-nisha', display_name: 'Nisha Verma', pseudonym: 'Person 003', department: 'Data Analytics', is_active: true },
  ]
  for (const reviewer of reviewers) {
    const { error } = await supabase.from('reviewers').upsert(reviewer, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${reviewers.length} reviewers`)
}

async function seedConnectors() {
  console.log('Seeding connectors...')
  const connectors = [
    { id: 'conn-google', app: 'google_workspace', status: 'active', last_sync_at: '2026-10-23T00:00:00Z', data_as_of: '2026-10-23', coverage_days: 180, consented_by: 'rev-asha', consented_at: '2026-10-01T00:00:00Z', revoked_at: null },
    { id: 'conn-entra', app: 'microsoft_entra', status: 'active', last_sync_at: '2026-10-23T00:00:00Z', data_as_of: '2026-10-23', coverage_days: 30, consented_by: 'rev-asha', consented_at: '2026-10-01T00:00:00Z', revoked_at: null },
    { id: 'conn-github', app: 'github', status: 'active', last_sync_at: '2026-10-23T00:00:00Z', data_as_of: '2026-10-23', coverage_days: 90, consented_by: 'rev-asha', consented_at: '2026-10-01T00:00:00Z', revoked_at: null },
  ]
  for (const conn of connectors) {
    const { error } = await supabase.from('connectors').upsert(conn, { onConflict: 'app' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${connectors.length} connectors`)
}

async function generateAndSeedGrants() {
  console.log('Generating and seeding grants...')
  const grantMap = new Map<string, any>()
  let grantIndex = 0

  // Generate grants from findings
  for (const finding of findings) {
    const key = `${finding.userId}-${finding.entitlementId}`
    if (!grantMap.has(key)) {
      const entitlement = entitlements.find((e) => e.id === finding.entitlementId)
      if (!entitlement) continue

      grantIndex++
      grantMap.set(key, {
        id: `grant-${String(grantIndex).padStart(4, '0')}`,
        user_id: finding.userId,
        entitlement_id: finding.entitlementId,
        app: mapApp(entitlement.app),
        granted_at: '2025-01-01T00:00:00Z',
        removed_at: null,
        source: 'directory_sync',
        first_seen_snapshot_id: 'snap-initial',
        last_seen_snapshot_id: null,
        is_simulated: false,
        created_at: '2025-01-01T00:00:00Z',
      })
    }
  }

  const grants = Array.from(grantMap.values())
  for (const grant of grants) {
    const { error } = await supabase.from('grants').upsert(grant, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${grants.length} grants`)
  return grants
}

async function seedSnapshotsWithRecomputedHashes(grants: any[]) {
  console.log('Seeding snapshots with recomputed hashes...')
  const demoNow = env.DEMO_NOW

  for (const snap of frontendSnapshots) {
    const app = mapApp(snap.app)
    const takenAt = snap.date + 'T00:00:00Z'

    // Get grants active at this snapshot time
    const activeGrants = grants.filter(
      (g) => g.app === app && g.granted_at <= takenAt && (g.removed_at === null || g.removed_at > takenAt)
    )

    // Compute content hash
    const grantStrings = activeGrants
      .map((g) => `${g.user_id}|${g.entitlement_id}`)
      .sort()
      .join('\n')

    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(grantStrings))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // Check if hash changed
    if (hashHex !== snap.hash) {
      recomputedHashes.push(snap.id)
    }

    const { error } = await supabase.from('snapshots').upsert({
      id: snap.id,
      app,
      taken_at: takenAt,
      complete: snap.complete,
      member_count: activeGrants.length,
      content_hash: hashHex,
      is_simulated: false,
      created_at: takenAt,
    }, { onConflict: 'id' })
    if (error) throw error
  }

  // Append final complete snapshot per app at DEMO_NOW if needed
  const apps = ['google_workspace', 'microsoft_entra', 'github'] as const
  for (const app of apps) {
    const lastSnap = frontendSnapshots.filter((s) => mapApp(s.app) === app).sort((a, b) => b.date.localeCompare(a.date))[0]
    if (lastSnap && lastSnap.date !== '2026-10-23') {
      const takenAt = demoNow
      const activeGrants = grants.filter(
        (g) => g.app === app && g.granted_at <= takenAt && (g.removed_at === null || g.removed_at > takenAt)
      )

      const grantStrings = activeGrants
        .map((g) => `${g.user_id}|${g.entitlement_id}`)
        .sort()
        .join('\n')

      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(grantStrings))
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      const { error } = await supabase.from('snapshots').upsert({
        id: `snap-${app}-final`,
        app,
        taken_at: takenAt,
        complete: true,
        member_count: activeGrants.length,
        content_hash: hashHex,
        is_simulated: false,
        created_at: takenAt,
      }, { onConflict: 'id' })
      if (error) throw error

      recomputedHashes.push(`snap-${app}-final (appended)`)
    }
  }

  console.log(`✓ Seeded ${frontendSnapshots.length} snapshots`)
  if (recomputedHashes.length > 0) {
    console.log(`  Hashes recomputed for: ${recomputedHashes.join(', ')}`)
  }
}

async function seedRoleChanges() {
  console.log('Seeding role changes...')
  for (const rc of frontendRoleChanges) {
    const { error } = await supabase.from('role_changes').upsert({
      id: rc.id,
      user_id: rc.userId,
      previous_department: rc.from,
      new_department: rc.to,
      previous_title: null,
      new_title: null,
      previous_manager: null,
      new_manager: null,
      changed_at: rc.date + 'T00:00:00Z',
      grace_days: 30,
      status: rc.status === 'In grace' ? 'in_grace' : 'past_grace',
    }, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${frontendRoleChanges.length} role changes`)
}

async function seedEvidence() {
  console.log('Seeding evidence...')
  for (const ev of frontendEvidence) {
    const { error } = await supabase.from('evidence').upsert({
      id: ev.id,
      type: ev.type,
      occurred_at: ev.at,
      source: ev.source,
      payload: ev.payload,
      derived: ev.derived,
    }, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${frontendEvidence.length} evidence records`)
}

async function seedSyncSchedules() {
  console.log('Seeding sync schedules...')
  const schedules = [
    { app: 'google_workspace', frequency: 'weekly', enabled: true, last_run_at: '2026-10-22T00:00:00Z', next_run_at: '2026-10-29T00:00:00Z', actor_id: 'rev-vikram', updated_at: '2026-10-01T00:00:00Z' },
    { app: 'microsoft_entra', frequency: 'daily', enabled: true, last_run_at: '2026-10-22T00:00:00Z', next_run_at: '2026-10-23T00:00:00Z', actor_id: 'rev-vikram', updated_at: '2026-10-01T00:00:00Z' },
    { app: 'github', frequency: 'weekly', enabled: true, last_run_at: '2026-10-16T00:00:00Z', next_run_at: '2026-10-23T00:00:00Z', actor_id: 'rev-vikram', updated_at: '2026-10-01T00:00:00Z' },
  ]
  for (const schedule of schedules) {
    const { error } = await supabase.from('sync_schedules').upsert(schedule, { onConflict: 'app' })
    if (error) throw error
  }
  console.log(`✓ Seeded ${schedules.length} sync schedules`)
}

async function verifyCounts() {
  console.log('Verifying counts...')
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
  const { count: entitlementCount } = await supabase.from('entitlements').select('*', { count: 'exact', head: true })
  const { count: snapshotCount } = await supabase.from('snapshots').select('*', { count: 'exact', head: true })

  console.log(`  Users: ${userCount} (expected ~${users.length})`)
  console.log(`  Entitlements: ${entitlementCount} (expected ~${entitlements.length})`)
  console.log(`  Snapshots: ${snapshotCount} (expected ~${frontendSnapshots.length})`)

  // Check for incomplete Entra snapshot
  const { data: incompleteSnap } = await supabase.from('snapshots').select('*').eq('app', 'microsoft_entra').eq('complete', false).single()
  if (incompleteSnap) {
    console.log(`  ✓ Incomplete Entra snapshot found: ${incompleteSnap.id}`)
  }

  // Check for Google gap
  const googleSnaps = await supabase.from('snapshots').select('taken_at').eq('app', 'google_workspace').order('taken_at')
  const snapDates = googleSnaps.data?.map((s) => s.taken_at.slice(0, 10)) || []
  const hasGap = !snapDates.includes('2026-05-14') && !snapDates.includes('2026-05-21')
  if (hasGap) {
    console.log(`  ✓ Google gap detected (expected around 2026-05-14 to 2026-05-28)`)
  }
}

async function main() {
  if (process.argv.includes('--verify')) {
    await verifyCounts()
    return
  }

  console.log('Starting seed...')
  await seedUsers()
  await seedEntitlements()
  await seedReviewers()
  await seedConnectors()
  const grants = await generateAndSeedGrants()
  await seedSnapshotsWithRecomputedHashes(grants)
  await seedRoleChanges()
  await seedEvidence()
  await seedSyncSchedules()
  await verifyCounts()

  console.log('\n✓ Seed completed successfully')
  console.log(`Recomputed hashes for ${recomputedHashes.length} snapshots`)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
