# Feature 3 (F-03) Discovery Report

## 1. Exported Signatures in `src/engine/*`
- `src/engine/index.ts` is the only file in `src/engine/`.
- Exported functions and constants:
  - `DEMO_NOW = '2026-10-23T00:00:00Z'`
  - `observedDays(coverageStart: string, userStart: string, now = DEMO_NOW): number`
  - `classifyUsage(input: { observedDays: number; windowDays: number; lastUsedAt: string | null; evidenceIds?: string[]; dormantAccount?: boolean }): UsageResult`
  - `recommend(input: { usage: UsageResult; blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null; confidence: 'high' | 'medium' | 'low'; dormantAccount: boolean; hasDowngrade: boolean; type: string }): Recommendation`
  - `score(input: { severity: number; sensitivity: number; evidenceStrength: number; staleness: number; weights: { severity: number; sensitivity: number; evidenceStrength: number; staleness: number } }): number`
  - `validateClaims(sentences: { id: string; claims: Claim[] }[], evidence: Evidence[]): ValidationResult`
  - `canonicalJson(value: unknown): string`
  - `replaySnapshot(snapshot: { id: string; app: string; date: string; complete: boolean; members: number; hash: string }, corrupt?: boolean): { status: 'passed' | 'failed' | 'skipped'; snapshotId: string; reason: string }`
- Missing engine modules:
  - `usage.ts`, `observation.ts`, `mapping.ts`, `dedupe.ts`, `stale.ts`, `peers.ts`, `explain.ts` are missing from `src/engine/`. Per frozen-frontend rule 3, wrappers and implementations are placed in `server/src/engine-ext/`.

## 2. Signatures and Return Shapes in `staticApi` (`src/api/staticApi.ts` -> `src/api.ts`)
- `getFindings(): Promise<Finding[]>` - returns array of Finding objects from `src/data.ts`
- `getActivity(): Promise<ActivityEvent[]>` - returns 5 ActivityEvent objects from `src/data.ts`
- `getSettings(): Promise<Settings>` - returns default Settings object from `src/data.ts`
- `getEvidence(): Promise<Evidence[]>` - returns 12 Evidence objects from `src/data.ts`
- `getAudit(): Promise<AuditEvent[]>` - serves `listAudit`, returns array of AuditEvent objects
- Missing functions:
  - `getInventory`, `getMappingRules`, `mapEvent`, `getObservationWindows`, `getUsage`, `setSettings`, `runIngest` do not exist on `staticApi`. They will be provided by `httpApi.f03.reference.ts`.

## 3. Shapes in `src/types/contract.ts`
- `UsageResult`:
  `{ state: UsageState; lastUsedAt: string | null; observedDays: number; windowDays: number; evidenceIds: string[]; dormantAccount: boolean; decisionPath: string[] }`
- `Settings`:
  `{ unusedWindowDays: { admin: number; standard: number }; peerThresholdPct: number; minPeerCount: number; graceDays: number; staleGrantDays: number; staleReviewDays: number; blastRadiusMinCoverageDays: number; weights: { severity: number; sensitivity: number; evidenceStrength: number; staleness: number }; detectorsEnabled: Record<FindingType, boolean>; version: number }`
- `Finding`:
  `{ id: string; userId: string; entitlementId: string; app: App; type: FindingType; riskScore: number; recommendation: Recommendation; confidence: 'high' | 'medium' | 'low'; blastRadius: { actionsLast90d: number; ownedSharedResources: number } | null; usage: UsageResult; status: FindingStatus; ownerId: string; dueDate: string; evidenceIds: string[]; version: number }`
- `Entitlement`:
  `{ id: string; app: App; name: string; kind: 'role' | 'group' | 'permission'; privilegeLevel: 'read' | 'write' | 'admin'; dataSensitivity: 'public' | 'internal' | 'confidential' | 'pii_financial'; categories: string[]; seasonal?: boolean; downgradeToId?: string; version: number }`
- `Evidence`:
  `{ id: string; type: 'grant' | 'activity' | 'peer_calc' | 'role_change' | 'coverage'; occurredAt: string; source: string; payload: Record<string, string | number | boolean | null>; derived?: boolean }`
- `Claim`:
  `{ id: string; field: string; value: string | number; evidenceId: string }`
- `ExplanationSentence`:
  `{ id: string; template: string; claims: Claim[] }`
- Missing in `contract.ts`:
  - `ActivityEvent`, `EventMappingRule`, `IngestRun`, `ObservationRow`, `Connector`, `ValidationResult`. These are defined in `server/src/types/extra.f03.ts` and `server/src/types/extra.ts`.

## 4. Record Counts (`src/data.ts`)
- `users`: 7 records
- `entitlements`: 10 records
- `grants`: 8 records (derived in MemoryStore)
- `activity`: 5 records
- `connectors`: 3 records (Google Workspace, Microsoft Entra, GitHub)
- `evidence`: 12 records
- `findings`: 8 records
- `snapshots`: 4 records
- `roleChanges`: 2 records
- `handoffs`: 3 records
- `auditSeed`: 4 records

## 5. Blast Radius Definition
- The frontend engine takes `{ actionsLast90d: number; ownedSharedResources: number } | null` directly.
- Server-side definition:
  - If app `coverageDays` < effective `blastRadiusMinCoverageDays` (default 90): returns `null`.
  - Otherwise:
    - `actionsLast90d`: count of user's activity events in that app occurring within `[DEMO_NOW - 90 days, DEMO_NOW]`.
    - `ownedSharedResources`: count of distinct resources for that user in that app with `actionClass` in `['write', 'admin']` in the last 90 days.
  - For seed users with custom findings (e.g. Sana with 12 actions and 1 resource), the server calculation respects activity history + finding overrides.

## 6. Live Mapping vs Seed Activity
- In `src/data.ts`, `activity` events have `mapped: boolean` but not `mappedEntitlementId`.
- Live mapping against seed rules:
  - `a-1` (u-sana, GitHub, action: `repo.push`): maps to `e-github-write` (`acme/platform · Write`) -> mapped: true
  - `a-2` (u-divya, Google Workspace, action: `drive.read`): maps to `e-drive-write` or `e-support-read` -> mapped: true
  - `a-3` (u-meera, Google Workspace, action: `drive.read`): maps to `e-support-read` -> mapped: true
  - `a-4` (u-tara, Google Workspace, action: `export.csv`): no rule matches -> unmapped: null (agrees with seed `mapped: false`)
  - `a-5` (u-rohan, Microsoft Entra, action: `billing.view`): maps to `e-entra-app` -> mapped: true
- Rule: LIVE MAPPING WINS. Seed `mapped` flag agrees with live re-map.

## 7. Scenario Checks (S3, S6, S7, S8)
- **S3 (Karthik Menon):** `unused`, dormantAccount: true, observed: 180, blast radius 0/0, recommendation: Revoke, guard text: "Unused: 0 uses in 180 of 180 observed days". -> Matches expected.
- **S6 (Aarav Khanna):** `unknown`, guard text: "Only 11 days of logs. Cannot judge.", recommendation: Review (no Revoke or Downgrade). -> Matches expected.
- **S7 (Microsoft Entra rows):** `unknown`, blastRadius: null, recommendation: Review, retention note present ("Mirrors a 30-day documented retention assumption; usage can be unknown."). -> Matches expected.
- **S8 (Tara Bose / seasonal permission):** `e-export` has `seasonal: true`, confidence: low, recommendation: Review. -> Matches expected.

## 8. Frontend Tests and Typecheck
- `npm test` in root: 67 passed (5 test files).
- `tsc --noEmit` in root: 0 errors.
