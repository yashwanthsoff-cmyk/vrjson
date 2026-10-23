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
| Production build | PASS | `npm run build` completes |
| Lint | PASS (proxy) | `npm run lint` maps to `tsc --noEmit` and exits 0 |
| Tests | PASS | 9 Vitest tests pass across engine and action crawler suites |
| Runtime | PASS | `/`, `/queue` and `/manus-routes.json` return HTTP 200 on port 3000 |

## Status codes

PASS = present, data-driven, interactive and evidenced. PARTIAL = present but incomplete. MISSING = not found. FAKE = hardcoded or no real logic. DEAD = no handler/href. UNVERIFIED = not run or not safely testable.

## Core status

| ID / scope | Status | Evidence | First failure / gap |
|---|---|---|---|
| R1-01 synthetic banner | PASS | `src/App.tsx`, `AppShell`, persistent banner | Runtime route crawl still pending |
| R1-02 no hardcoded statistics | PARTIAL | `src/data.ts`, `src/App.tsx` | Demo wording and some UI defaults remain literal |
| R1-03 forbidden claims absent | PARTIAL | repository grep | Two intentional honesty-copy hits mention accuracy/automatic revocation |
| R1-04 no model call | PASS | no model imports/fetches | No model call found |
| R1-05 sample wording label | PASS | `ExplanationsPage`, `FindingDrawer` | Runtime click verification pending |
| R1-06 handoff only | PARTIAL | `api.createHandoff`, drawer | No full persisted decision snapshot |
| R1-07 no bulk decisions | PASS | queue/drawer controls and crawler | No bulk decision control found |
| R1-08 unknown guard | PARTIAL | drawer and usage UI | Separate backend invariant now exists, full UI test pending |
| R1-09 null blast-radius guard | PARTIAL | engine `recommend` and drawer guard | Full queue integration pending |
| R1-10 risk disclaimer | PASS | peer/mover pages and drawer | Runtime click verification pending |
| R1-11 unlinked explanations | PASS | `engine.validateClaims`, `ExplanationsPage` fallback | Full sentence-level test pending |
| R1-12 configurable-default labels | PASS | settings/peers/usage labels | Weight re-ranking incomplete |
| R1-13 pseudonym toggle | PARTIAL | `AppShell`, `displayName`, session store | Not proven on every screen |
| R1-14 append-only | PARTIAL | `api.log`, undo superseding event | Several simulations remain session-only |
| R1-15 viewed audit | PARTIAL | `api.getFinding` logs viewed | Once-per-session semantics not enforced |
| R1-16 data-action coverage | PASS | `src/action-coverage.test.ts` | Delegated handler covers unbound controls |
| R1-17 disabled reason | PARTIAL | unknown/revoked controls | Not every disabled control is covered |
| R2/R3 architecture | PARTIAL | `src/types`, `src/schemas`, `src/engine`, `src/store` now present | `src/features`, `src/components`, `src/scripts` absent |
| R31 REST contract | PARTIAL | `src/api/httpApi.ts` scaffold | No real backend/MSW and incomplete endpoint coverage |
| S1–S17 scenario tests | PARTIAL | 9 tests and seeded assertions | Full S1–S17 executable suite absent |
| E-* engine modules | PARTIAL | `src/engine/index.ts` | Modules are consolidated, not split by invariant |
| F-02 | PARTIAL | `SnapshotsPage`, `TimeTravelPage`, replay engine | Grant records, diff and scheduler incomplete |
| F-03 | PARTIAL | `UsagePage`, `ActivityPage`, coverage engine | Mapping rules, tagger and full what-if incomplete |
| F-05 | PARTIAL | `PeersPage` and tabs | Exceptions, normalizer and team mutations incomplete |
| F-06 | PARTIAL | `MoversPage`, `MoverCasePage` | HR simulation, stepper and grace recomputation incomplete |
| F-09 | PARTIAL | `ExplanationsPage`, engine validator | Review-pack export, verify and feedback missing |
| Supporting modules | PARTIAL | many routes in `src/App.tsx` | Several controls remain toast-only/read-only |
| Tests and generated actions | PARTIAL | action crawler and engine tests | No generator; `ACTIONS.md` remains hand-maintained |

## Batch results

| Batch | Scope | Result |
|---|---|---|
| 1 | Contract, schemas, engine safety, seed manifest, session store | PASS: typecheck, lint proxy, 5 tests and build |
| 2 | Static/HTTP API selector, HTTP client scaffold, error mapping | PASS: typecheck, lint proxy, 5 tests and build |
| 3 | Shared session store, delegated actions, decision reason selector, append-only undo | PASS: typecheck, 7 tests and build |
| 4 | F-09 validation/fallback, replay integrity, corrupt snapshot, consent revoke/restore | PASS: typecheck, 8 tests and build |
| 5 | API-backed queue refresh and core seeded scenario assertions | PASS: typecheck, 9 tests and build |

## Final verification

Final branch checks passed: `npm run typecheck`, `npm run lint`, `npm test -- --run` with 9 tests, and `npm run build`. Runtime checks returned HTTP 200 for `/`, `/queue` and `/manus-routes.json`; the manifest contains 28 routes. The branch is pushed to `origin/spec-compliance`.

## Remaining gaps / not yet PASS

The project is improved but not fully spec-compliant. Required `src/features/`, `src/components/` and `src/scripts/` trees are still absent. `src/App.tsx` still imports many data collections directly from `src/data.ts`, so the API-only UI boundary is not complete. The HTTP client is a scaffold and there is no backend or MSW contract server. The seed manifest is present but the required deterministic generator and complete JSON seed set are not. Settings and peer controls remain session what-ifs without full engine re-ranking. Several governance controls remain toast-only. Full F-02 grant records/time-travel diff/scheduler, F-03 mapping rules and sensitivity tagger, F-05 exceptions/title normalizer/team builder, F-06 HR simulation/stepper/grace recomputation, F-09 review-pack export/verify/feedback, and the full S1–S17 executable scenario suite are not complete.

Forbidden-term grep has two intentional honesty-copy hits in `src/App.tsx`: the scenario disclaimer says it does not establish real-world accuracy, and the About page says the demo claims neither accuracy nor automatic revocation. There are no model API calls and no bulk-decision controls found.
