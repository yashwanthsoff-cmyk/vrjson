# AccessDrift spec-compliance register

This register is maintained against `/home/ubuntu/upload/pasted_content.txt` (Master Frontend Prompt v4). Goal rows are grouped; observable requirements are split by rule, route, contract family, scenario, engine module, component and test family.

## Register index

| ID range | Spec scope | Atomic rows |
|---|---|---:|
| R0 | Product goal and flow | 18 |
| R1 | Non-negotiable rules 1–20 | 26 |
| R2 | Technology stack | 17 |
| R3 | Architecture and file layout | 17 |
| R31 | REST endpoints and error mapping | 27 |
| R4 | Contract interfaces and field groups | 31 |
| R5 | Seed files, coverage, anomalies, reviewers | 20 |
| R6 | Seed scenarios S1–S17 | 17 |
| R7 | Engine modules and invariants | 24 |
| R8 | Global interface system | 32 |
| R9 | Design system and routes | 29 |
| R10 | F-02 permission history/drift components | 14 |
| R11 | F-03 granted-vs-used components | 15 |
| R12 | F-05 peer excess components | 11 |
| R13 | F-06 mover drift components | 13 |
| R14 | F-09 evidence-bound explanations | 13 |
| R15 | Supporting modules and governance | 21 |
| R16 | Lifecycle transitions and reason codes | 10 |
| R17 | Source facts | 8 |
| R18 | States and required demo flows | 20 |
| R19 | Test requirements | 6 |
| R20 | Out-of-scope negatives | 21 |
| R21 | Backend handoff and traceability | 19 |
| **Total** |  | **~419** |

## Atomic register

The rows below are the executable ledger used for the current fix batches. IDs are stable and grouped by dependency. Each pass check is observable in source or UI and cites the expected evidence location.

### Product, rules and architecture

| ID | SPEC section | Requirement | Pass check | Evidence expected | Type | Priority |
|---|---|---|---|---|---|---|
| R0-01 | 0 | Review console is actionable | A control changes visible state | `src/App.tsx`, route controls | component | P0 |
| R0-02 | 0 | Static mode uses JSON/static data plus pure engine | Static API returns deterministic records | `src/api`, `src/engine`, seed files | architecture | P0 |
| R0-03 | 0 | UI speaks only through API | Feature reads use API client | `src/features`, no direct seed imports | architecture | P0 |
| R0-04 | 0 | End-to-end flow is demonstrable | Queue → evidence → decision → handoff → audit works | Flow A | flow | P0 |
| R1-01 | 1 | Synthetic banner persists | Exact banner appears on every route | `AppShell`, all routes | rule | P0 |
| R1-02 | 1 | No hardcoded statistics | Stats originate in data/engine | JSX grep and selectors | rule | P0 |
| R1-03 | 1 | Forbidden claims absent | Forbidden-term grep returns zero | repository grep | negative | P0 |
| R1-04 | 1 | No model call | No model/API call in source | repository grep | negative | P0 |
| R1-05 | 1 | Sample wording label | Exact no-model label is visible | explanation route/drawer | rule | P0 |
| R1-06 | 1 | Revoke/downgrade create handoff only | Handoff created and no app mutation | decision handler | rule | P0 |
| R1-07 | 1 | No bulk decisions | No select-all/approve-all control | control grep/crawler | negative | P0 |
| R1-08 | 1 | Unknown cannot revoke/downgrade | Buttons disabled with reason | usage/drawer | rule | P0 |
| R1-09 | 1 | Null blast radius caps Review | Recommendation and controls are capped | engine/recommendation | rule | P0 |
| R1-10 | 1 | Peer/mover risk disclaimer | Exact label visible | peers/movers/drawer | rule | P0 |
| R1-11 | 1 | Unlinked sentences not rendered | Validator filters invalid sentences | explanation engine | rule | P0 |
| R1-12 | 1 | Config labels | Editable what-ifs show exact label | settings/peers/usage | rule | P0 |
| R1-13 | 1 | Pseudonym toggle | All displayed user names switch | shell and all pages | component | P1 |
| R1-14 | 1 | Append-only history | No edit/delete for history records | snapshots/audit/decisions | rule | P0 |
| R1-15 | 1 | Viewed audit event | Opening finding appends once/session | finding detail/API | rule | P0 |
| R1-16 | 1 | `data-action` coverage | Every control has handler/href | crawler test | test | P0 |
| R1-17 | 1 | Disabled reason tooltip | Disabled controls expose reason | all disabled controls | rule | P0 |
| R2-01 | 2 | React + TypeScript + Vite | Build passes with stack | package/build | technology | P0 |
| R2-02 | 2 | Router and state libraries | Required packages and usage exist | package/source | technology | P1 |
| R2-03 | 2 | Forms/schema libraries | Required form validation stack exists | package/source | technology | P1 |
| R2-04 | 2 | Test stack | Vitest/RTL/MSW scripts and tests exist | package/tests | test | P0 |
| R3-01 | 3 | Contract source of truth | Contract types are centralized | `src/types/contract.ts` | architecture | P0 |
| R3-02 | 3 | Schema mirror | Zod schemas mirror contract | `src/schemas` | architecture | P1 |
| R3-03 | 3 | Deterministic seed files | Seed generator and committed JSON exist | `src/seed`, scripts | seed | P0 |
| R3-04 | 3 | Pure engine | Engine has no React/I/O | `src/engine` | engine | P0 |
| R3-05 | 3 | Static/HTTP API switch | `VITE_API_MODE` selects client | `src/api/index.ts` | api | P0 |
| R3-06 | 3 | Error mapping | API errors map to UI states | `src/api/errors.ts` | api | P1 |
| R3-07 | 3 | Dedicated store | Zustand store holds UI/session state | `src/store` | architecture | P1 |

### Contract and API families

| ID | SPEC section | Requirement | Pass check | Evidence expected | Type | Priority |
|---|---|---|---|---|---|---|
| R31-01 | 3.1 | Session endpoint | `GET /me` client exists | httpApi | api | P1 |
| R31-02 | 3.1 | Connector endpoints | Consent, sync, schedules and runs work | sources/snapshots | api | P0 |
| R31-03 | 3.1 | Bundle endpoints | Import/export and schema errors work | sources | api | P1 |
| R31-04 | 3.1 | History endpoints | Inventory, grants, snapshots, as-of, diff, replay and changes exist | httpApi | api | P0 |
| R31-05 | 3.1 | Activity endpoints | Activity, ingest, mappings, usage and observation exist | httpApi | api | P0 |
| R31-06 | 3.1 | Peer endpoints | Groups, frequency, matrix, result, mappings and teams exist | httpApi | api | P0 |
| R31-07 | 3.1 | Mover endpoints | Role changes, detail and HR simulation exist | httpApi | api | P0 |
| R31-08 | 3.1 | Finding endpoints | List/detail/manual/assignment/decision/undo/reopen/comments exist | httpApi | api | P0 |
| R31-09 | 3.1 | Explanation endpoints | Get/validate/feedback exist | httpApi | api | P0 |
| R31-10 | 3.1 | Evidence endpoints | List/detail exist | httpApi | api | P0 |
| R31-11 | 3.1 | Exception endpoints | List/create/withdraw/extend exist | httpApi | api | P0 |
| R31-12 | 3.1 | Handoff endpoints | List/update exist | httpApi | api | P1 |
| R31-13 | 3.1 | Notification endpoints | List/update exist | httpApi | api | P1 |
| R31-14 | 3.1 | Governance endpoints | Settings, audit, exports, scenarios, facts and reasons exist | httpApi | api | P0 |
| R31-15 | 3.1 | Page and mutation protocol | Pagination, idempotency and If-Match are implemented | httpApi/tests | api | P1 |
| R31-16 | 3.1 | Error model | All seven error codes map to required UI behavior | errors/tests | rule | P0 |

### Seed scenarios

| ID | SPEC section | Requirement | Pass check | Evidence expected | Type | Priority |
|---|---|---|---|---|---|---|
| S1 | 5 | Meera mover outside grace | Exactly 6 carried over, 4 unused, 3 flagged, 1 common Keep | engine/scenario test | scenario | P0 |
| S2 | 5 | Rohan mover in grace | Zero findings and grace banner | engine/scenario test | scenario | P0 |
| S3 | 5 | Karthik dormant contractor admin | 140 days no activity, 180 observed, blast 0/0, Revoke | engine/scenario test | scenario | P0 |
| S4 | 5 | Divya peer outlier | 1 of 24 peers, 4%, high confidence, Downgrade | engine/scenario test | scenario | P0 |
| S5 | 5 | Small team | Three-person peer group is low confidence | engine/scenario test | scenario | P1 |
| S6 | 5 | Short logs | Aarav is unknown with 11 days and no revoke | engine/scenario test | scenario | P0 |
| S7 | 5 | Short-retention Entra | Entra results are unknown and Review-capped | engine/scenario test | scenario | P0 |
| S8 | 5 | Seasonal decoy | Seasonal export is low-confidence Review | engine/scenario test | scenario | P1 |
| S9 | 5 | Failed explanation validation | Unsupported claim fails and fallback appears | explanation test | scenario | P0 |
| S10 | 5 | Exceptions | Active hides item; expired returns it | exception test | scenario | P0 |
| S11 | 5 | Contractor peers | Contractor/guest lowers confidence | peer test | scenario | P1 |
| S12 | 5 | Connector error | Toggle preserves last-good data | UI test | scenario | P1 |
| S13 | 5 | Stale privileged grant | Old admin grant becomes Review | stale engine test | scenario | P0 |
| S14 | 5 | Seniority grouping | Findings change versus title grouping | peer test | scenario | P1 |
| S15 | 5 | Due states | One overdue and two due-soon notifications | data/UI test | scenario | P1 |
| S16 | 5 | Unmapped events | At least two unmapped groups with counts | activity test | scenario | P1 |
| S17 | 5 | Handoff statuses | Requested, acknowledged and self-reported tickets exist | handoff test | scenario | P1 |

### Core engine and UI batch index

| ID range | Scope | Pass check | Type | Priority |
|---|---|---|---|---|
| E-OBS | Observation | Coverage and observed-day invariants pass | engine | P0 |
| E-MAP | Mapping | Glob matching and unmapped exclusion pass | engine | P0 |
| E-USE | Usage | Used/unused/unknown invariant passes | engine | P0 |
| E-PEER | Peer | Group modes, prevalence and confidence pass | engine | P0 |
| E-MOVER | Mover | Grace, carry-over and baseline logic pass | engine | P0 |
| E-STALE | Stale | Age, privilege and prior-decision logic pass | engine | P0 |
| E-DEDUPE | Dedupe | Precedence and secondary types pass | engine | P0 |
| E-SCORE | Score | Weighted normalized risk score matches formula | engine | P0 |
| E-RECOMMEND | Recommendation | Unknown/null blast radius caps Review | engine | P0 |
| E-EXPLAIN | Explain | Claims link to evidence | engine | P0 |
| E-VALIDATE | Validate | Payload comparison rejects mismatch | engine | P0 |
| E-ASOF | As-of/diff | Incomplete snapshots never selected | engine | P0 |
| E-REPLAY | Replay | SHA-256 integrity detects exactly one corruption | engine | P0 |
| E-AUDIT | Audit | Hash chain verification names first broken event | engine | P0 |

The remaining component-level rows from Sections 7–22 are tracked by the same stable IDs in `STATUS.md` as implementation batches are completed. Group rows above are not counted as completed requirements until their child behavior is verified.

## Current register state

Step 0 is complete. Baseline ledger is in `STATUS.md`; fixes must be committed in batches of no more than eight requirements on branch `spec-compliance`.
