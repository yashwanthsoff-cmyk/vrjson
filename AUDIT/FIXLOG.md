
## Batch 1 — contract and engine safety

- Added `src/types/contract.ts` with centralized contract types.
- Added `src/schemas/contract.ts` with core Zod schemas.
- Added `src/engine/index.ts` with usage classification, recommendation guards, normalized scoring, claim validation and canonical JSON helper.
- Added `src/engine/index.test.ts` with five invariant tests.
- Added `src/seed/manifest.json` with deterministic seed metadata.
- Added `src/store/session.ts` for session preference/state shape.
- Added `typecheck`, `lint` and `test` scripts.
- Verification: typecheck PASS, lint proxy PASS, 5 tests PASS, production build PASS.

## Batch 2 — API boundary

- Added `src/api/index.ts` to select static or HTTP mode using `VITE_API_MODE`.
- Added `src/api/staticApi.ts`, `src/api/httpApi.ts` and `src/api/errors.ts`.
- Routed `src/App.tsx` through `src/api/index.ts`.
- Verification pending.

Batch 2 verification: typecheck PASS, lint proxy PASS, 5 tests PASS, production build PASS.

## Batch 3 — shared interaction coverage and decision undo

- Connected `AppShell` preferences and scenario toggles to `src/store/session.ts`.
- Added app-shell delegated `data-action` handlers for controls without local handlers.
- Added append-only `api.undo()` and an Undo action to the finding drawer.
- Added reason-code selector to the finding decision drawer.
- Added `src/action-coverage.test.ts` crawler; 7 tests now pass.
- Verification: typecheck PASS, action crawler PASS, engine tests PASS, production build PASS.
