# Frontend Wiring Guide for Feature 3 (F-03)

This guide documents how to wire the complete React frontend to the F-03 backend once the frozen-frontend constraint is lifted.

---

## 1. Setup & Environment
1. Ensure `server/.env` has `CORS_ORIGIN=http://localhost:5173`.
2. In the frontend root `.env` or `.env.local`:
   ```bash
   VITE_API_BASE=http://localhost:8787
   ```

---

## 2. API Client Integration
1. Review `docs/httpApi.f03.reference.ts`.
2. Copy the methods into `src/api/httpApi.ts` or instantiate `createF03Api(import.meta.env.VITE_API_BASE)`.
3. In `src/api/httpApi.ts`, replace any delegations from `staticApi` for activity and usage with live HTTP calls.

---

## 3. Component Wiring Matrix

| UI Component | Backend Endpoint | Function |
|---|---|---|
| **Activity Stream** (`src/components/ActivityStream.tsx`) | `GET /api/activity` | Fetches activity rows with live-mapped entitlement IDs and usernames. |
| **Activity Summary Banner** | `GET /api/activity/summary` | Displays mapped vs unmapped event counters and top unmapped actions. |
| **Mapping Rules Table** (`src/components/MappingRules.tsx`) | `GET /api/mapping-rules` | Displays rules with specificity badges and matched event counts. |
| **Rule Tester & Modal** (`src/components/RuleModal.tsx`) | `POST /api/mapping/test`, `POST /api/mapping-rules` | Tests glob patterns live and adds rules to session overlay. |
| **Observation Windows Table** | `GET /api/observation-windows` | Visualizes window status and short log indicators. |
| **Usage Detector Table** (`src/components/UsageTable.tsx`) | `GET /api/usage` | Displays classified access usage with guard texts and risk scores. |
| **Recommendation Card** (`src/components/RecommendationCard.tsx`) | `GET /api/recommendation/:userId/:entitlementId` | Displays action ladder, confidence, and blast radius breakdown. |
| **Coverage Guard Badge** | `GET /api/coverage-guard/:userId/:entitlementId` | Shows exact guard text and enforces inability to revoke during short logs. |
| **What-If Settings Bar** (`src/components/WhatIfBar.tsx`) | `PUT /api/settings/effective` | Applies non-destructive what-if settings with real-time delta badges. |
| **Ingest Simulation Button** | `POST /api/ingest/simulate` | Ingests 3 sample events advancing simulation time. |
| **Usage Summary AI Card** | `POST /api/usage-summary` | Displays verified AI summaries or deterministic template fallback. |
| **Scenario Verification** | `GET /api/scenario-checks/f03` | Validates that all planted test scenarios pass. |

---

## 4. Session & Header Management
All frontend requests should include:
- `x-session-id`: Generated and stored in `localStorage.getItem('accessdrift_session_id') || ('sess-' + Date.now())`. This keeps exploratory what-if settings isolated to the browser tab.
- `x-actor-id`: Stored in `localStorage` based on the selected reviewer (e.g., `rev-asha`).
- `x-request-id`: Automatically generated per request for traceability.

---

## 5. Safe Rollback
To revert any component back to offline static mode, change its API import from `httpApi` back to `staticApi`.
