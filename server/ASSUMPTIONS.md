# ASSUMPTIONS.md

## Deviations from the master build prompt

### 1. Engine Function Availability
The prompt assumes these engine functions exist in `src/engine/*`:
- asof, diff, replay, prepost, explain, validate, dedupe, score, recommend, usage, observation, peers, movers, stale

**Actual situation:**
- Only `replay`, `validate` (as `validateClaims`), `score`, `recommend`, and partial `usage` (as `classifyUsage`) exist
- Missing functions must be implemented in `server/src/engine-ext/`

### 2. Seed Data Format
The prompt expects `src/seed/*.json` files with:
- users.json, entitlements.json, grants.json, snapshots.json, evidence.json, etc.
- Snapshots with stored contentHash values
- Per-snapshot membership data

**Actual situation:**
- Only `src/seed/manifest.json` exists
- All data is in TypeScript arrays in `src/data.ts`
- Snapshot hashes are display strings like "sha256:9d4f…82aa" (with ellipsis), not real SHA-256
- No per-snapshot membership - must derive from grants
- No grants.json - must generate from evidence + findings

**Impact:**
- Seed loader must import from `src/data.ts` instead of reading JSON
- All snapshot contentHash values must be recomputed from derived grants
- Grant records must be generated from findings and evidence
- Snapshot membership is derived from grants using rule 2

### 3. Type Mismatches
**App naming:**
- Contract.ts uses: `'google_workspace' | 'microsoft_entra' | 'github'`
- data.ts uses: `'Google Workspace' | 'Microsoft Entra' | 'GitHub'`
- Need mapping function between these

**Evidence fields:**
- Contract: `occurredAt: string`
- data.ts: `at: string`
- Need field mapping

**Missing contract types:**
- SyncSchedule
- SyncRun
- PrePostComparison
- RoleChange (exists in data.ts but not contract.ts)
- Must be added in `server/src/types/extra.ts`

### 4. API Function Names
The prompt expects these staticApi functions:
- getInventory, getGrants, getSnapshots, getAccessAsOf, diffSnapshots, runReplayCheck, getRoleChanges, getEvidence, flagManual, listAudit, runSync, getSettings

**Actual staticApi (via src/api.ts):**
- getFindings, getFinding, decide, undo, assign, comment, createHandoff
- getAudit, getEvidence, getExplanation, verifyAudit
- replay (not runReplayCheck), sync (not runSync)
- getHandoffs, getActivity, getSnapshots, getUsers, getEntitlements, getPeerGroups, getRoleChanges, getSettings, getConnectors
- revokeConsent, restoreConsent

**Impact:**
- Backend implements its own API contract per section 5
- Frontend httpApi.reference.ts will bridge the differences
- Backend does not need to match the existing staticApi exactly

### 5. Demo NOW Location
- `src/engine/index.ts` exports `DEMO_NOW = '2026-10-23T00:00:00Z'`
- `src/data.ts` also exports `DEMO_NOW = '2026-10-23T00:00:00Z'`
- Both are consistent, but server should use the engine version via import

### 6. Seed Hash Policy
**Prompt requirement:** Recompute every snapshot contentHash and memberCount with rule 4 before inserting.

**Current seed situation:**
- Snapshots have placeholder hashes
- No grants exist to compute hashes from
- Must generate grants first, then recompute hashes

**Implementation:**
1. Seed loader generates minimal grant records from findings and evidence
2. Computes contentHash using rule 4 (SHA-256 of sorted `userId|entitlementId` strings)
3. Stores the computed hash, overwriting the placeholder
4. Logs which snapshots had their hash changed
5. Appends a final complete snapshot per app at DEMO_NOW if needed

### 7. Append-Only Enforcement
The prompt specifies triggers to enforce append-only behavior on:
- grants, snapshots, sync_runs, audit_events, manual_findings

**MemoryStore implementation:**
- In-memory checks for DELETE and illegal UPDATE operations
- Throws errors matching the SQL trigger logic

**SupabaseStore implementation:**
- Relies on database triggers in `002_append_only.sql`
- Cannot bypass triggers even with service role

### 8. Simulated Sync Index
The prompt requires `sim_index` with a unique constraint for simulated sync runs.

**Implementation:**
- Sync runs table has `sim_index int` column
- Unique index on `sim_index where sim_index is not null`
- Server uses per-process async mutex plus DB uniqueness
- On conflict, retries once with a fresh index

### 9. Groq Amendment
**Prompt original rule:** "no language model is called"

**Amendment for F-02:** Groq gpt-oss is used ONLY for the `/drift-summary` endpoint.

**Guardrails:**
- Deterministic template fallback on any error or validation failure
- Claims must be bound to evidence payload fields
- Templates must contain no digits (except placeholders)
- No banned words in generated text
- Caching by scope_key to avoid repeated calls
- Rate limiting (10 per minute)
- Latency and token usage logged only (never prompts or keys)

### 10. Path Aliases
**Prompt:** `@engine/*` maps to `../src/engine/*`, `@contract` maps to `../src/types/contract.ts`

**Implementation:**
- Configured in `tsconfig.json` paths
- Configured in `vitest.config.ts` resolve.alias
- Works with tsx for development

### 11. Environment Setup
The `.env` file cannot be committed due to root `.gitignore` matching `.env*`.

**User action required:**
Create `server/.env` with the values from the prompt's section 1.

### 12. Test Data Generation
Since no seed JSON files exist, the MemoryStore test setup will:
1. Import users, entitlements, roleChanges from `src/data.ts`
2. Generate minimal grant records from findings in `src/data.ts`
3. Generate minimal snapshots based on the snapshot array in `src/data.ts`
4. Compute contentHash values using rule 4
5. This provides a consistent baseline for tests

### 13. Connector Error Simulation
The prompt mentions dev flags for connector errors.

**Implementation:**
- `dev_flags` table stores `simulateConnectorError` as a JSON object mapping App to boolean
- Reads for that app return frozen data with `x-data-as-of` header
- Writes for that app return 503 or 409 depending on revoked vs error state


## Feature 3 (F-03 Granted-vs-Used Detector) Assumptions

### 1. Live Mapping Precedence
- Seed `activity` in `src/data.ts` includes a boolean `mapped` flag but does not specify target entitlement IDs.
- In accordance with the prompt ("LIVE MAPPING WINS"), all event mappings are dynamically evaluated via `computeLiveMapping(event, effectiveRules)`.
- Precedence for glob matching strictly adheres to:
  1. Exact app match (`google_workspace`, `microsoft_entra`, `github`).
  2. Pattern match via glob compiled to anchored regex.
  3. Most literal characters (highest specificity score).
  4. Lowest rule ID lexicographically.

### 2. Entra 30-Day Retention & S7 Test Invariant
- Microsoft Entra logs default to 30 days retention, while standard inactivity policy requires 180 days.
- In accordance with Scenario S7, Entra usage rows evaluate to `unknown` with `blastRadius: null` and recommendation capped at `review`.
- No seed Entra activity events map to granted Entra entitlements.

### 3. Session Overlays & What-If Isolation
- Exploratory user adjustments to settings, tags, and mapping rules are isolated to client sessions via `x-session-id`.
- Handled by `server/src/engine-ext/overlay.ts` with a 120-minute sliding TTL and a 500-session LRU capacity cap.
- Non-session requests fall back to baseline settings and seed rules.

### 4. Blast Radius Definition
- Blast radius is defined as `{ actionsLast90d: number, ownedSharedResources: number }`.
- Calculated by counting actions performed in the last 90 days before `DEMO_NOW`.
- Hard-capped at `null` when app log coverage is less than 90 days (such as Entra at 30 days or short logs simulation at 11 days).

### 5. Ingest Simulation
- `POST /api/ingest/simulate` consumes 3 sample events from `server/src/seed/sampleIngestEvents.json` per invocation.
- Events receive simulated timestamps equal to `DEMO_NOW + ingIndex * 60000` ms.
- A process-level mutex prevents race conditions or out-of-order sequence indexing during concurrent simulation requests.

### 6. Groq AI Summary & Safety Guardrails
- `POST /api/usage-summary` calls Groq `gpt-oss-120b` (with fallback to `gpt-oss-20b`) with a 15-second timeout and 10 req/min rate limit.
- Verified against banned marketing/compliance words and strict claim linkage to underlying `Evidence` IDs.
- If verification fails or Groq is unreachable, gracefully falls back to deterministic template explanation from `usageExplain.ts`.

### 7. CSV Formula Injection Safety
- All CSV download routes (`/api/export/*.csv`) prepend an apostrophe `'` to any cell starting with `=`, `+`, `-`, or `@`.
