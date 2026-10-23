# STEP 0: DISCOVERY REPORT

## 1. Engine Files (src/engine/*)

**File: `src/engine/index.ts`**
Exports available:
- `DEMO_NOW: string` = '2026-10-23T00:00:00Z'
- `observedDays(coverageStart, userStart, now?): number`
- `classifyUsage(input): UsageResult`
- `recommend(input): Recommendation`
- `score(input): number`
- `validateClaims(sentences, evidence): {claims, linked, passed, failures}`
- `canonicalJson(value): string`
- `replaySnapshot(snapshot, corrupt?): {status, snapshotId, reason}`

**Missing exports** (mentioned in prompt but not present):
- asof
- diff
- prepost
- explain
- dedupe
- coverage
- usage (partial: classifyUsage exists but not full usage module)
- observation
- peers
- movers
- stale

**Conclusion:** Most engine functions need to be implemented in `server/src/engine-ext/`.

## 2. Static API Functions

**Expected (from prompt):**
- getInventory, getGrants, getSnapshots, getAccessAsOf, diffSnapshots, runReplayCheck, getRoleChanges, getEvidence, flagManual, listAudit, runSync, getSettings

**Actual (in src/api.ts, which staticApi delegates to):**
- getFindings, getFinding, decide, undo, assign, comment, createHandoff
- getAudit, getEvidence, getExplanation, verifyAudit
- replay, corruptSnapshot, sync
- getHandoffs, getActivity, getSnapshots, getUsers, getEntitlements, getPeerGroups, getRoleChanges, getSettings, getConnectors
- revokeConsent, restoreConsent

**Deviations:**
- Missing: getInventory, getGrants, getAccessAsOf, diffSnapshots, flagManual, listAudit (as generic list)
- Name differences: `replay` vs `runReplayCheck`, `sync` vs `runSync`
- Extra functions for frontend-specific operations (decide, undo, assign, etc.)

**Conclusion:** Backend will implement its own set of API endpoints; the frontend httpApi will bridge differences.

## 3. Contract Types (src/types/contract.ts)

**Present:**
- App = 'google_workspace' | 'microsoft_entra' | 'github'
- UsageState, FindingType, UiRole, FindingStatus, Recommendation
- Page<T>, ApiError
- User, Entitlement, Grant, Snapshot, Evidence, Claim, ExplanationSentence
- UsageResult, Finding, Decision, AuditEvent, Settings

**Missing (from prompt):**
- SyncSchedule
- SyncRun
- PrePostComparison
- RoleChange (exists in data.ts but not exported from contract.ts)

**Note:** `App` enum uses underscores (`google_workspace`) while data.ts uses spaces (`Google Workspace`).

## 4. Seed Files (src/seed/*.json)

**Actual:**
- Only `manifest.json` exists with:
  - rngSeed: 20261023
  - demoNow: "2026-10-23T00:00:00Z"
  - mode: "static"
  - datasets: ["users", "entitlements", "grants", "snapshots", "evidence", "findings", "activity", "roleChanges", "handoffs", "audit"]

**Deviations:**
- No separate JSON files for datasets (users.json, grants.json, etc.)
- All data is in `src/data.ts` as TypeScript arrays
- No snapshot membership data in snapshots array (only id, app, date, complete, members, hash, changes)
- No stored contentHash values that can be recomputed (hashes are like "sha256:9d4f…82aa" with ellipsis)

**Snapshot array (from data.ts):**
```typescript
export const snapshots = [
  { id: 'snap-google-20261023', app: 'Google Workspace', date: '2026-10-23', complete: true, members: 31, hash: 'sha256:9d4f…82aa', changes: '+3 / −1' },
  { id: 'snap-entra-20260312', app: 'Microsoft Entra', date: '2026-03-12', complete: false, members: 26, hash: 'skipped · incomplete', changes: '+0 / −0' },
  { id: 'snap-google-20260514', app: 'Google Workspace', date: '2026-05-14', complete: true, members: 28, hash: 'sha256:2c18…7b04', changes: '+5 / −2' },
  { id: 'snap-github-20261016', app: 'GitHub', date: '2026-10-16', complete: true, members: 17, hash: 'sha256:47b3…ca90', changes: '+1 / −0' },
]
```

**Conclusion:** Seed data loader will need to:
1. Load data from `src/data.ts` arrays instead of JSON files
2. Generate grant records from evidence and user/entitlement relationships
3. Recompute all snapshot contentHash values from generated grants
4. Derive snapshot membership from grants using rule 2

## 5. Frontend Tests

**Test command:** `npm test`
**Result:** PASS - 2 test files, 9 tests passing
- src/action-coverage.test.ts (2 tests)
- src/engine/index.test.ts (7 tests)

**TypeScript check:** `npx tsc --noEmit`
**Result:** PASS - no errors

## 6. Key Deviations to Log in ASSUMPTIONS.md

1. **Engine functions missing:** Most functions (asof, diff, prepost, explain, coverage, peers, movers, stale) must be implemented in `server/src/engine-ext/`
2. **Seed format:** No JSON files - data is in TypeScript arrays in `src/data.ts`
3. **Snapshot hashes:** Seed hashes are display strings with ellipsis, not real SHA-256 values - must recompute all
4. **Snapshot membership:** Not stored - must derive from grants
5. **Grant records:** Not in seed - must generate from evidence + users + entitlements
6. **App naming:** Contract uses `google_workspace`, data uses `Google Workspace` - need mapping
7. **Missing contract types:** SyncSchedule, SyncRun, PrePostComparison, RoleChange must be added in server/src/types/extra.ts
8. **API signatures:** Frontend staticApi has different functions than prompt expects - backend implements its own contract
9. **Demo NOW location:** Both `src/engine/index.ts` and `src/data.ts` define DEMO_NOW - must ensure consistency
10. **Evidence format:** Frontend evidence has `at` field, contract has `occurredAt` - need mapping

## 7. Grant Data Reconstruction

Since no grants.json exists, grants must be reconstructed from:
- Users (7 users in data.ts)
- Entitlements (10 entitlements in data.ts)
- Evidence of type 'grant' (3 grant evidence records)
- Findings (each finding links userId + entitlementId, implying a grant exists)

**Strategy:** Server seed loader will generate minimal grant records from findings and evidence, then recompute snapshot hashes from those grants.
