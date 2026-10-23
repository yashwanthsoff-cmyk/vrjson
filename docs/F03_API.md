# AccessDrift Feature 3 (F-03 Granted-vs-Used Detector) API Documentation

## 1. Overview & Principles
Feature 3 (F-03) adds a backend granted-vs-used risk detector to AccessDrift:
- **Core framing**: Detects risky access using transparent rules and real evidence, explains every recommendation, and routes it to a human reviewer.
- **Synthetic data**: All data is synthetic demo data. Health checks carry `syntheticDataNotice: "Synthetic demo data. No real people or systems. Nothing here changes any real app."`
- **Live Mapping Wins**: Seed activity mappings are never trusted blindly; mappings are recomputed dynamically via glob rules with exact literal specificity precedence.
- **Defensive Observation Windows**: Prevents premature revocations when log retention is shorter than policy windows (e.g. 30-day Entra retention).

---

## 2. Request Headers & Session Overlays
| Header | Description | Default |
|---|---|---|
| `x-session-id` | Identifies client session for non-destructive what-if overlays (rules, settings, tags). Overlays expire after 120 minutes of inactivity. | `sess-default` |
| `x-actor-id` | Active reviewer ID (for audit logging). | `rev-asha` |
| `x-request-id` | Unique request correlation ID. | Auto-generated |
| `x-data-as-of` | Timestamp of last known good sync. | Current DEMO_NOW |

---

## 3. Endpoints Reference

### Activity & Ingest
- `GET /api/activity`
  - **Query**: `app`, `userId`, `mapped` ('true'|'false'), `limit` (default 50), `cursor`
  - **Response**: `{ items: ActivityRow[], total: number, cursor?: string }`
  - **Headers**: `X-Total-Count`

- `GET /api/activity/summary`
  - **Query**: `app` (optional)
  - **Response**: `{ totalEvents: number, mappedEvents: number, unmappedEvents: number, topUnmappedEvents: Array<{ action: string, count: number }> }`

- `GET /api/ingest-runs`
  - **Query**: `app`, `limit`
  - **Response**: `{ runs: IngestRun[], total: number }`

- `POST /api/ingest/simulate`
  - **Body**: `{ app: App }`
  - **Description**: Consumes 3 sample events from `sampleIngestEvents.json` advancing `ingIndex`. Handles concurrency with process mutex. Returns 503 if `simulateConnectorError` dev flag is active, or 409 if samples exhausted.
  - **Response**: `{ success: true, count: 3, simIndex: number, run: IngestRun, events: ActivityRow[], unmappedNow: number }`

---

### Mapping Rules
- `GET /api/mapping-rules`
  - **Response**: `{ rules: MappingRuleView[], total: number }` (includes `specificity` score and `matchCount`)

- `POST /api/mapping/test`
  - **Body**: `{ action: string, app: App }`
  - **Response**: `{ app: App, action: string, matchedRule: MappingRuleView | null, entitlementId: string | null, entitlementName: string | null, message: string }`

- `POST /api/mapping-rules`
  - **Body**: `{ app: App, actionPattern: string, entitlementId: string, note?: string }`
  - **Response**: `201 Created` with `MappingRuleView`

- `PUT /api/mapping-rules/:id`
  - **Body**: `{ actionPattern?: string, entitlementId?: string, note?: string }`
  - **Response**: `200 OK` with updated `MappingRuleView`

- `DELETE /api/mapping-rules/:id`
  - **Response**: `{ success: true, deletedRuleId: string }`

---

### Observation & Usage Detection
- `GET /api/observation-windows`
  - **Response**: `{ windows: ObservationRowView[], total: number }`

- `GET /api/usage`
  - **Query**: `userId`, `app`, `state`, `dormant`, `seasonal`, `minRisk`, `limit`, `cursor`
  - **Response**: `{ items: UsageRow[], total: number, cursor?: string }`

- `GET /api/usage/:userId/:entitlementId`
  - **Response**: Single `UsageRow` or RFC 7807 404

- `GET /api/usage/findings`
  - **Response**: `{ findings: Finding[], total: number }`

- `POST /api/usage/evaluate`
  - **Body**: `{ user?, entitlement?, activityTimestamps?, allAppActivityTimestamps?, grantedAt? }`
  - **Response**: Stateless evaluation `{ usage, recommendation, guardText, coverage, riskScore, scoreBreakdown }`

---

### Recommendations & Guard Text
- `GET /api/recommendation/:userId/:entitlementId`
  - **Response**: `RecommendationCardData` with `action`, `confidence`, `blastRadius`, `blastRadiusText`, `evidenceIds`, `evidence`, `guardText`

- `GET /api/coverage-guard/:userId/:entitlementId`
  - **Response**: `{ guardText: string, observedDays: number, windowDays: number, coverageDays: number, isShortLogs: boolean, canRevoke: boolean }`

---

### Tags & Settings Overlays
- `GET /api/tags`: Returns entitlement tags and session overrides
- `PUT /api/tags`: `{ targetType: 'user'|'entitlement', targetId: string, tags?: string[], privilegeLevel?: string, dataSensitivity?: string }`
- `DELETE /api/tags`: `{ targetType: 'user'|'entitlement', targetId: string, tag: string }`
- `GET /api/settings/effective`: Effective settings with session overlay
- `PUT /api/settings/effective`: Update session settings, returns `{ settings, diff: { added, removed, actionChanged } }`
- `POST /api/settings/reset`: Reset session settings to default
- `DELETE /api/session/overlay`: Clear entire session overlay

---

### CSV Exports
All CSV endpoints implement formula injection prevention (prepends `'` if any cell starts with `=`, `+`, `-`, or `@`).
- `GET /api/export/activity.csv`: Download activity events
- `GET /api/export/usage.csv`: Download usage state records
- `GET /api/export/inventory.csv`: Download current grant inventory

---

### Scenarios & AI Summaries
- `GET /api/scenario-checks/f03`
  - **Response**: `{ label: "Checks that the logic reproduces planted scenarios. Not an accuracy measure.", allPassed: boolean, scenarios: ScenarioCheckResult[] }`
  - Validates planted scenarios:
    - **S3**: Karthik Menon (dormant contractor admin) -> `unused`, dormantAccount true, observed 180, blast radius 0/0, recommendation Revoke.
    - **S6**: Aarav Khanna (short logs) -> `unknown`, guardText "Only 11 days of logs. Cannot judge.", recommendation Review.
    - **S7**: Entra 30-day retention -> all Entra rows unknown, blastRadius null, recommendation capped at Review.
    - **S8**: Tara Bose seasonal export -> `seasonal: true`, confidence low, recommendation Review.

- `POST /api/usage-summary`
  - **Body**: `{ userId: string, app?: App, showNames?: boolean }`
  - **Rate Limit**: 10 req/min
  - **Description**: Uses Groq `gpt-oss-120b` (fallback `gpt-oss-20b`) with a 15-second timeout and strict claim verification against underlying evidence. If LLM call fails, contains banned words, or references missing claims, automatically falls back to deterministic template explanation.
  - **Response**: `{ summary: UsageSummary }`
