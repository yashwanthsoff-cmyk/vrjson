# AccessDrift compliance status ledger

Branch: `spec-compliance`
Spec: `/home/ubuntu/upload/pasted_content.txt`
Project: `/home/ubuntu/accessdrift`

## Baseline

| Check | Result | Evidence |
|---|---|---|
| Branch | PASS | `git branch --show-current` → `spec-compliance` |
| Install | PASS | Existing `node_modules`; package lock present |
| Typecheck | PASS | `npx tsc --noEmit` exited 0 |
| Production build | PASS | Existing `npm run build` completed before audit |
| Lint | UNVERIFIED | No `lint` script exists in `package.json` |
| Tests | UNVERIFIED | No test script or test files exist |
| Runtime | PASS | `GET /` and `/manus-routes.json` returned HTTP 200 on port 3000 |

## Status codes

PASS = present, data-driven, interactive and evidenced. PARTIAL = present but incomplete. MISSING = not found. FAKE = hardcoded or no real logic. DEAD = no handler/href. UNVERIFIED = not run or not safely testable.

## Current ledger

| ID / scope | Status | Evidence | First failure / gap |
|---|---|---|---|
| R1-01 synthetic banner | PASS | `src/App.tsx`, `AppShell`, `synthetic-banner`, all routed pages | Runtime route crawl still pending |
| R1-02 no hardcoded statistics | PARTIAL | `src/data.ts`, `src/App.tsx` | Multiple JSX literals and demo values remain |
| R1-03 forbidden claims absent | PARTIAL | repository grep pending | `ASSUMPTIONS.md` and `plan.md` contain some forbidden terms as documentation |
| R1-04 no model call | PASS | `src/api.ts`, no model imports/fetches | No model call found |
| R1-05 sample wording label | PASS | `src/App.tsx`, `FindingDrawer`, `ExplanationsPage` | Runtime click verification pending |
| R1-06 handoff only | PARTIAL | `src/api.ts`, `createHandoff`; `FindingDrawer` | Handoff API is static only; no full decision snapshot |
| R1-07 no bulk decisions | PASS | `src/App.tsx`, queue/drawer controls | Crawler test missing |
| R1-08 unknown guard | PARTIAL | `FindingDrawer`, `UsagePage` | Guard exists in UI but not a separate engine invariant/test |
| R1-09 null blast-radius guard | PARTIAL | `FindingDrawer`, finding data | Not implemented as pure recommendation engine |
| R1-10 risk disclaimer | PASS | `FindingDrawer`, `PeersPage`, `MoverCasePage` | Runtime click verification pending |
| R1-11 unlinked explanations | FAKE | `src/data.ts`, `getExplanation` | Validation is not a real payload comparison engine |
| R1-12 configurable-default labels | PASS | `src/App.tsx`, settings/peers/usage | Weight editing and re-ranking missing |
| R1-13 pseudonym toggle | PARTIAL | `AppShell`, `displayName` | Not proven on every screen |
| R1-14 append-only | PARTIAL | `api.log`, audit lists | Several simulated controls do not create persistent records |
| R1-15 viewed audit | PARTIAL | `api.getFinding` logs viewed | Once-per-session semantics not enforced |
| R1-16 data-action coverage | UNVERIFIED | `data-action` attributes appear in `src/App.tsx` | No crawler test |
| R2/R3 architecture | MISSING | Only `src/App.tsx`, `src/api.ts`, `src/data.ts` exist | Required modules/folders absent |
| R31 REST contract | MISSING | No `httpApi.ts`, schemas or contract types | Static facade covers only a subset |
| S1–S17 scenario tests | UNVERIFIED | Seed examples exist in `src/data.ts` | No executable scenario test suite |
| E-* engine modules | MISSING | No `src/engine/` | Logic remains in data/UI |
| F-02 | PARTIAL | `SnapshotsPage`, `TimeTravelPage`, `MoverCasePage` | Grant records, diff, replay hashing and scheduler incomplete |
| F-03 | PARTIAL | `UsagePage`, `ActivityPage` | Mapping rules, tagger and real what-if recomputation incomplete |
| F-05 | PARTIAL | `PeersPage` and tabs | Groups/frequency/matrix are partly present; mutation behavior incomplete |
| F-06 | PARTIAL | `MoversPage`, `MoverCasePage` | Simulate dialog, stepper, complete pre/post data missing |
| F-09 | PARTIAL | `ExplanationsPage`, drawer evidence tab | Real validator, feedback, pack export/verification missing |
| Supporting modules | PARTIAL | Many routes exist in `src/App.tsx` | Most controls are toast-only or read-only; several required pages are absent |
| Tests and generated actions | MISSING | No tests; hand-written `ACTIONS.md` | No generator/crawler |

## Fix queue

1. Contract, schemas, static seed shape and pure deterministic engine.
2. API split with HTTP client, error mapping and session store.
3. Shared interaction system and crawler coverage.
4. Queue lifecycle, decision snapshots, undo and handoff tracker.
5. F-09, F-02, F-03, F-05, F-06.
6. Governance, demo guide and full states.
7. Tests, generated actions and final re-verification.

## Batch results

| Batch | Scope | Result |
|---|---|---|
| 1 | Contract, schemas, engine safety, seed manifest, session store | PASS: typecheck, lint proxy, 5 tests and build |
| 2 | Static/HTTP API selector, HTTP client scaffold, error mapping | IN PROGRESS: one strict type issue fixed; verification rerun required |
